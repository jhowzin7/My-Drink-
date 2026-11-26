// Simulação didática: estas credenciais ficam visíveis no código do navegador.
// Em um sistema real, o login e as permissões devem ser verificados no servidor.
const GESTOR_USUARIO = "gestor";
const GESTOR_SENHA = "mydrink@2026";

(function () {
  const storage = window.MyDrinkStorage;
  const loginForm = document.querySelector("#manager-login-form");

  if (loginForm) {
    loginForm.addEventListener("submit", (evento) => {
      evento.preventDefault();
      const mensagem = document.querySelector("#manager-login-message");
      mensagem.textContent = "";
      const usuario = document.querySelector("#manager-user").value.trim();
      const senha = document.querySelector("#manager-password").value;
      if (usuario !== GESTOR_USUARIO || senha !== GESTOR_SENHA) {
        mensagem.textContent = "Usuário ou senha não conferem.";
        return;
      }
      storage.iniciarSessaoGestor();
      window.location.href = "gestor.html";
    });
    return;
  }

  const dashboard = document.querySelector("#panel-overview");
  if (!dashboard) return;

  try {
    if (!storage.temSessaoGestor()) {
      window.location.replace("gestor-login.html");
      return;
    }
    storage.prepararDadosExemplo();
  } catch (erro) {
    window.location.replace("gestor-login.html");
    return;
  }

  const aviso = document.querySelector("#manager-message");
  const tabs = [...document.querySelectorAll("[data-manager-tab]")];
  const panels = [...document.querySelectorAll("[data-manager-panel]")];
  const stockForm = document.querySelector("#product-form");
  const variantList = document.querySelector("#product-variants");
  const extendedHoursButton = document.querySelector("#toggle-extended-hours");
  const copaoCheckbox = document.querySelector("#product-allow-copao");
  const beverageTypeSelect = document.querySelector("#product-beverage-type");
  const mixtureCheckbox = document.querySelector("#product-allow-mixture");
  const restrictedCheckbox = document.querySelector("#product-restricted");
  const variantHelp = stockForm.querySelector(".variant-editor .field-help");
  let produtoEmEdicao = null;
  let contadorCampoVariante = 0;

  function criarNo(tag, texto, classe) {
    const elemento = document.createElement(tag);
    if (texto !== undefined && texto !== null) elemento.textContent = String(texto);
    if (classe) elemento.className = classe;
    return elemento;
  }

  function celula(linha, texto, classe) {
    const elemento = criarNo("td", texto, classe);
    linha.append(elemento);
    return elemento;
  }

  function formatarMoeda(valor) {
    if (valor === null || !Number.isFinite(Number(valor))) return "[PREÇO A CONFIRMAR]";
    return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatarTelefone(valor) {
    const digitos = String(valor || "").replace(/\D/g, "");
    if (digitos.length === 11) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
    if (digitos.length === 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
    return "[TELEFONE A CONFIRMAR]";
  }

  function dataLocal(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  function mostrarAba(nome) {
    tabs.forEach((aba) => {
      const ativa = aba.dataset.managerTab === nome;
      aba.classList.toggle("is-active", ativa);
      aba.setAttribute("aria-selected", String(ativa));
      aba.tabIndex = ativa ? 0 : -1;
    });
    panels.forEach((painel) => {
      painel.hidden = painel.dataset.managerPanel !== nome;
    });
  }

  tabs.forEach((aba, indice) => {
    aba.addEventListener("click", () => mostrarAba(aba.dataset.managerTab));
    aba.addEventListener("keydown", (evento) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(evento.key)) return;
      evento.preventDefault();
      const proximo = evento.key === "Home" ? 0
        : evento.key === "End" ? tabs.length - 1
          : (indice + (evento.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[proximo].focus();
      mostrarAba(tabs[proximo].dataset.managerTab);
    });
  });

  function calcularResumo(pedidos, produtos) {
    const agora = new Date();
    const concluidos = pedidos.filter((pedido) => pedido.status === "Entregue");
    const totalHoje = concluidos
      .filter((pedido) => new Date(pedido.criadoEm).toDateString() === agora.toDateString())
      .reduce((soma, pedido) => soma + (Number(pedido.total) || 0), 0);
    const totalMes = concluidos
      .filter((pedido) => {
        const data = new Date(pedido.criadoEm);
        return data.getFullYear() === agora.getFullYear() && data.getMonth() === agora.getMonth();
      })
      .reduce((soma, pedido) => soma + (Number(pedido.total) || 0), 0);
    const vendasComValor = concluidos.filter((pedido) => pedido.total !== null && Number.isFinite(Number(pedido.total)));
    const totalVendido = vendasComValor.reduce((soma, pedido) => soma + Number(pedido.total), 0);
    const produtosEmFalta = produtos.reduce((total, produto) => {
      return total + produto.variantes.filter((variante) => variante.ativo && variante.estoque <= variante.minimo).length;
    }, 0);
    document.querySelector("#sales-today").textContent = formatarMoeda(totalHoje);
    document.querySelector("#sales-month").textContent = formatarMoeda(totalMes);
    document.querySelector("#orders-count").textContent = String(pedidos.length);
    document.querySelector("#average-ticket").textContent = formatarMoeda(vendasComValor.length ? totalVendido / vendasComValor.length : 0);
    document.querySelector("#pending-count").textContent = String(pedidos.filter((pedido) => !["Entregue", "Cancelado"].includes(pedido.status)).length);
    document.querySelector("#low-stock-count").textContent = String(produtosEmFalta);
  }

  function proximaAcao(status) {
    if (status === "Recebido") return { label: "Iniciar preparo", next: "Em preparo" };
    if (status === "Em preparo") return { label: "Marcar pronto", next: "Pronto" };
    if (status === "Pronto") return { label: "Marcar entregue", next: "Entregue" };
    return null;
  }

  function mostrarPedidos() {
    const pedidos = storage.buscarPedidos()
      .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
    const statusFiltro = document.querySelector("#order-status-filter").value;
    const dataFiltro = document.querySelector("#order-date-filter").value;
    const lista = document.querySelector("#manager-orders");
    lista.replaceChildren();

    const filtrados = pedidos.filter((pedido) => {
      const data = new Date(pedido.criadoEm);
      return (!statusFiltro || pedido.status === statusFiltro)
        && (!dataFiltro || (!Number.isNaN(data.getTime()) && dataLocal(data) === dataFiltro));
    });
    if (!filtrados.length) {
      lista.append(criarNo("p", "Nenhum pedido corresponde aos filtros.", "empty-state"));
      return;
    }

    filtrados.forEach((pedido) => {
      const cartao = criarNo("article", "", "manager-card order-manager-card");
      const topo = criarNo("div", "", "manager-card-heading");
      const titulo = criarNo("h3", `Pedido ${pedido.id}`);
      const status = criarNo("span", pedido.status, `status-pill status-${pedido.status.toLowerCase().replace(/\s+/g, "-")}`);
      topo.append(titulo, status);
      if (pedido.exemplo) topo.append(criarNo("span", "Exemplo", "example-tag"));
      cartao.append(topo);
      const data = new Date(pedido.criadoEm);
      cartao.append(criarNo("p", `Data: ${Number.isNaN(data.getTime()) ? "Não informada" : data.toLocaleString("pt-BR")}`));
      cartao.append(criarNo("p", `Cliente: ${pedido.cliente || "Cliente não informado"} · ${formatarTelefone(pedido.telefone)}`));
      const itens = document.createElement("ul");
      pedido.itens.forEach((item) => {
        const preco = item.precoUnitario === null ? "" : ` — ${formatarMoeda(item.precoUnitario * item.quantidade)}`;
        const opcao = item.variante ? ` — ${item.variante}` : "";
        itens.append(criarNo("li", `${item.nome}${opcao}: ${item.quantidade} un.${preco}`));
      });
      cartao.append(itens);
      cartao.append(criarNo("p", `Total: ${formatarMoeda(pedido.total)} · ${pedido.tipoEntrega || "Retirada na loja"} · ${pedido.pagamento || "Pagamento a confirmar"}`));
      if (pedido.endereco) cartao.append(criarNo("p", `Endereço: ${pedido.endereco}`));
      if (pedido.observacoes) cartao.append(criarNo("p", `Observações: ${pedido.observacoes}`));

      const acoes = criarNo("div", "", "button-row");
      const acao = proximaAcao(pedido.status);
      if (acao) {
        const botaoAvancar = criarNo("button", acao.label, "button button-primary");
        botaoAvancar.type = "button";
        botaoAvancar.addEventListener("click", () => mudarStatus(pedido.id, acao.next));
        acoes.append(botaoAvancar);
        const botaoCancelar = criarNo("button", "Cancelar pedido", "button button-danger");
        botaoCancelar.type = "button";
        botaoCancelar.addEventListener("click", () => mudarStatus(pedido.id, "Cancelado"));
        acoes.append(botaoCancelar);
      }
      if (acoes.childElementCount) cartao.append(acoes);
      lista.append(cartao);
    });
  }

  function mudarStatus(id, status) {
    try {
      storage.atualizarStatusPedido(id, status);
      aviso.textContent = status === "Cancelado"
        ? "Pedido cancelado; as unidades voltaram ao estoque."
        : `Status atualizado: ${status}.`;
      atualizarPainel();
    } catch (erro) {
      aviso.textContent = erro.message;
    }
  }

  function mostrarEstoque() {
    const produtos = storage.buscarProdutos();
    const corpo = document.querySelector("#stock-table-body");
    corpo.replaceChildren();
    const categoria = document.querySelector("#stock-category-filter")?.value || "";
    const termo = document.querySelector("#stock-search")?.value.trim().toLocaleLowerCase("pt-BR") || "";
    const somenteFalta = document.querySelector("#stock-only-low")?.checked;
    produtos
      .filter((produto) => !categoria || produto.categoria === categoria)
      .filter((produto) => !termo || produto.nome.toLocaleLowerCase("pt-BR").includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .forEach((produto) => {
      produto.variantes
        .filter((variante) => !somenteFalta || (variante.ativo && variante.estoque <= variante.minimo))
        .forEach((variante) => {
        const linha = document.createElement("tr");
        if (variante.estoque === 0) linha.className = "stock-zero";
        else if (variante.estoque <= variante.minimo) linha.className = "stock-low";
        celula(linha, produto.nome);
        celula(linha, variante.nome);
        celula(linha, produto.categoria);
        celula(linha, produto.somenteCopao ? "Não se aplica" : formatarMoeda(variante.preco));
        celula(linha, variante.estoque);
        celula(linha, variante.minimo);
        celula(linha, !variante.ativo
          ? "Desativada"
          : variante.estoque === 0
            ? "Indisponível"
            : produto.somenteCopao
              ? "Estoque de sabor do copão"
              : variante.preco === null
              ? "Preço a confirmar"
              : "Disponível");
        const acoes = celula(linha, "");
        const editar = criarNo("button", "Editar", "text-button");
        editar.type = "button";
        editar.addEventListener("click", () => abrirFormularioProduto(produto));
        const ativar = criarNo("button", produto.ativo === false ? "Ativar produto" : "Desativar produto", "text-button");
        ativar.type = "button";
        ativar.addEventListener("click", () => {
          try {
            storage.salvarProduto({
              ...produto,
              ativo: produto.ativo === false
            });
            aviso.textContent = produto.ativo === false ? "Produto ativado." : "Produto desativado.";
            atualizarPainel();
          } catch (erro) {
            aviso.textContent = erro.message;
          }
        });
        const remover = criarNo("button", "Remover produto", "text-button danger-text");
        remover.type = "button";
        remover.addEventListener("click", () => {
          if (!window.confirm(`Remover ${produto.nome} e todas as opções?`)) return;
          try {
            storage.removerProduto(produto.id);
            aviso.textContent = "Produto removido.";
            atualizarPainel();
          } catch (erro) {
            aviso.textContent = erro.message;
          }
        });
        acoes.append(editar, document.createTextNode(" "), ativar, document.createTextNode(" "), remover);
        corpo.append(linha);
      });
    });
    if (!produtos.length) {
      const linha = document.createElement("tr");
      const vazio = celula(linha, "Nenhum produto cadastrado.");
      vazio.colSpan = 8;
      corpo.append(linha);
    }
  }

  function mostrarFaltas() {
    const lista = document.querySelector("#missing-products");
    lista.replaceChildren();
    const faltas = storage.buscarProdutos().flatMap((produto) => {
      if (produto.ativo === false) return [];
      return produto.variantes
        .filter((variante) => variante.ativo && variante.estoque <= variante.minimo)
        .map((variante) => ({ produto, variante }));
    });
    if (!faltas.length) {
      lista.append(criarNo("p", "Nenhum produto está abaixo do mínimo cadastrado.", "empty-state"));
      return;
    }
    faltas.forEach(({ produto, variante }) => {
      const linha = criarNo("article", "", `manager-card shortage-card${variante.estoque === 0 ? " stock-zero" : " stock-low"}`);
      linha.append(criarNo("h3", `${produto.nome} — ${variante.nome}`));
      linha.append(criarNo("p", `${produto.categoria} · estoque: ${variante.estoque} · mínimo: ${variante.minimo}`));
      lista.append(linha);
    });
  }

  function desenharBarras(alvo, entradas, rotulo, valores, formatarValor = formatarMoeda) {
    const grafico = document.querySelector(alvo);
    grafico.replaceChildren();
    if (!entradas.length) {
      grafico.append(criarNo("p", "Ainda não há dados para este gráfico.", "empty-state"));
      return;
    }
    const maior = Math.max(1, ...entradas.map((item) => valores(item)));
    entradas.forEach((item) => {
      const linha = criarNo("div", "", "chart-row");
      const nome = rotulo(item);
      const valor = valores(item);
      linha.append(criarNo("span", nome, "chart-label"));
      const trilho = criarNo("div", "", "chart-track");
      const barra = criarNo("span", "", "chart-bar");
      barra.style.width = `${Math.max(valor > 0 ? 3 : 0, (valor / maior) * 100)}%`;
      trilho.append(barra);
      linha.append(trilho, criarNo("span", formatarValor(valor), "chart-value"));
      linha.setAttribute("aria-label", `${nome}: ${formatarValor(valor)}`);
      grafico.append(linha);
    });
  }

  function mostrarVendas() {
    const pedidos = storage.buscarPedidos().filter((pedido) => pedido.status === "Entregue");
    const hoje = new Date();
    const dias = [];
    for (let deslocamento = 6; deslocamento >= 0; deslocamento -= 1) {
      const dia = new Date(hoje);
      dia.setDate(hoje.getDate() - deslocamento);
      const chave = dataLocal(dia);
      const vendas = pedidos
        .filter((pedido) => dataLocal(new Date(pedido.criadoEm)) === chave)
        .reduce((soma, pedido) => soma + (Number(pedido.total) || 0), 0);
      dias.push({ nome: dia.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }), vendas });
    }
    desenharBarras("#sales-chart", dias, (item) => item.nome, (item) => item.vendas);

    const quantidades = new Map();
    pedidos.forEach((pedido) => pedido.itens.forEach((item) => {
      const nome = item.variante ? `${item.nome} — ${item.variante}` : item.nome;
      quantidades.set(nome, (quantidades.get(nome) || 0) + item.quantidade);
    }));
    const maisVendidos = [...quantidades.entries()]
      .map(([nome, quantidade]) => ({ nome, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);
    desenharBarras(
      "#products-chart",
      maisVendidos,
      (item) => item.nome,
      (item) => item.quantidade,
      (valor) => String(valor)
    );
  }

  function mostrarClientes() {
    const corpo = document.querySelector("#customers-table-body");
    corpo.replaceChildren();
    const pedidos = storage.buscarPedidos();
    storage.buscarUsuarios().forEach((usuario) => {
      const linha = document.createElement("tr");
      celula(linha, usuario.nome);
      celula(linha, formatarTelefone(usuario.telefone));
      celula(linha, usuario.email);
      celula(linha, storage.mascararCpf(usuario.cpf));
      celula(linha, pedidos.filter((pedido) => pedido.clienteId === usuario.id).length);
      corpo.append(linha);
    });
    if (!corpo.childElementCount) {
      const linha = document.createElement("tr");
      const vazio = celula(linha, "Ainda não há clientes cadastrados.");
      vazio.colSpan = 5;
      corpo.append(linha);
    }
  }

  function configurarControlesCatalogoGestor() {
      const categorias = storage.obterCategoriasProdutos();
      const seletor = document.querySelector("#stock-category-filter");
      if (seletor) {
        const atual = seletor.value;
        seletor.replaceChildren(criarNo("option", "Todas", ""));
        seletor.firstElementChild.value = "";
        categorias.forEach((categoria) => {
          const opcao = criarNo("option", categoria);
          opcao.value = categoria;
          seletor.append(opcao);
        });
        if (categorias.includes(atual)) seletor.value = atual;
      }
      const datalist = document.querySelector("#product-category-list");
      if (datalist) {
        datalist.replaceChildren();
        categorias.forEach((categoria) => {
          const opcao = document.createElement("option");
          opcao.value = categoria;
          datalist.append(opcao);
        });
      }
  }

  function carregarMedidasLoja() {
      const medidas = storage.obterMedidasLoja();
      document.querySelector("#copao-size").value = medidas.copao.tamanhoCopoMl;
      document.querySelector("#dose-size").value = medidas.dose.tamanhoCopoMl;
      document.querySelector("#copao-energy").checked = medidas.copao.energeticoIncluso;
      document.querySelector("#copao-drink-volume").value = medidas.copao.bebidaNoCopaoMl || "";
    }

    document.querySelector("#store-measures-form").addEventListener("submit", (evento) => {
      evento.preventDefault();
      try {
        storage.salvarMedidasLoja({
          copao: {
            tamanhoCopoMl: document.querySelector("#copao-size").value,
            energeticoIncluso: document.querySelector("#copao-energy").checked,
            bebidaNoCopaoMl: document.querySelector("#copao-drink-volume").value
          },
          dose: { tamanhoCopoMl: document.querySelector("#dose-size").value }
        });
        aviso.textContent = "Medidas da loja atualizadas.";
        atualizarPainel();
      } catch (erro) {
        aviso.textContent = erro.message;
      }
    });
  carregarMedidasLoja();

  function atualizarPainel() {
    const pedidos = storage.buscarPedidos();
    const produtos = storage.buscarProdutos();
    configurarControlesCatalogoGestor();
    calcularResumo(pedidos, produtos);
    mostrarPedidos();
    mostrarEstoque();
    mostrarFaltas();
    mostrarVendas();
    mostrarClientes();
  }

  function atualizarControleHorarioEstendido() {
    try {
      const status = storage.obterStatusFuncionamento();
      const ativo = status.horarioEstendidoAtivo;
      extendedHoursButton.textContent = ativo
        ? "Desativar horário estendido"
        : "Ativar horário estendido até 3h";
      extendedHoursButton.setAttribute("aria-pressed", String(ativo));
      extendedHoursButton.disabled = !status.configurado && !ativo;
    } catch (erro) {
      extendedHoursButton.disabled = true;
      aviso.textContent = erro.message || "Não foi possível consultar o horário da loja.";
    }
  }

  extendedHoursButton.addEventListener("click", () => {
    try {
      const status = storage.obterStatusFuncionamento();
      storage.definirHorarioEstendidoHoje(!status.horarioEstendidoAtivo);
      aviso.textContent = status.horarioEstendidoAtivo
        ? "Horário estendido desativado."
        : "Horário estendido ativado para hoje, até as 3h.";
      atualizarControleHorarioEstendido();
    } catch (erro) {
      aviso.textContent = erro.message;
    }
  });
  atualizarControleHorarioEstendido();
  window.setInterval(atualizarControleHorarioEstendido, 60_000);

  function criarCampoVariante(linha, rotulo, nomeCampo, tipo, valor, indice) {
    const grupo = criarNo("div", "", "variant-field");
    const id = `product-variant-${indice}-${nomeCampo}`;
    const label = criarNo("label", rotulo);
    label.htmlFor = id;
    const input = document.createElement("input");
    input.id = id;
    input.dataset.variantField = nomeCampo;
    input.type = tipo;
    if (tipo === "number") {
      input.min = "0";
      input.step = nomeCampo === "preco" ? "0.01" : "1";
      input.required = nomeCampo !== "preco";
      if (nomeCampo === "preco") input.placeholder = "[PREÇO A CONFIRMAR]";
    }
    input.value = valor === null || valor === undefined ? "" : String(valor);
    if (nomeCampo === "estoque") input.dataset.savedStock = input.value;
    if (nomeCampo === "minimo") input.dataset.savedMinimum = input.value;
    grupo.append(label, input);
    linha.append(grupo);
    return input;
  }

  function atualizarBotoesRemoverVariante() {
    const linhas = [...variantList.querySelectorAll(".variant-editor-row")];
    linhas.forEach((linha) => {
      linha.querySelector(".variant-remove").disabled = linhas.length === 1;
    });
  }

  function atualizarCamposDerivados() {
    if (!variantList) return;
    const linhas = [...variantList.querySelectorAll(".variant-editor-row")];
    const linhaGarrafa = linhas.find((linha) =>
      linha.querySelector('[data-variant-field="nome"]').value.trim().toLocaleLowerCase("pt-BR") === "garrafa"
    );
    const garrafaEstoque = linhaGarrafa
      ? Number(linhaGarrafa.querySelector('[data-variant-field="estoque"]').value || 0)
      : 0;

    linhas.forEach((linha) => {
      const nomeInput = linha.querySelector('[data-variant-field="nome"]');
      const estoqueInput = linha.querySelector('[data-variant-field="estoque"]');
      const minimoInput = linha.querySelector('[data-variant-field="minimo"]');
      const nome = nomeInput.value.trim().toLocaleLowerCase("pt-BR");
      const temGarrafa = Boolean(linhaGarrafa);
      const ehDose = nome.startsWith("dose");

      if (temGarrafa && ehDose) {
        estoqueInput.value = String(Math.max(0, garrafaEstoque * 10));
        estoqueInput.disabled = true;
        estoqueInput.required = false;
        minimoInput.disabled = true;
        minimoInput.required = false;
        if (Number(minimoInput.value || 0) !== 0) minimoInput.value = "0";
        estoqueInput.title = "Calculado automaticamente: 10 doses por garrafa";
      } else {
        estoqueInput.disabled = false;
        estoqueInput.required = true;
        minimoInput.disabled = false;
        minimoInput.required = true;
        estoqueInput.removeAttribute("title");
      }
    });
  }

  function adicionarLinhaVariante(variante = {}) {
    contadorCampoVariante += 1;
    const indice = contadorCampoVariante;
    const linha = document.createElement("fieldset");
    linha.className = "variant-editor-row";
    linha.dataset.variantId = variante.id || "";
    linha.append(criarNo("legend", "Opção de venda"));

    const campos = criarNo("div", "", "variant-fields");
    criarCampoVariante(campos, "Apresentação", "nome", "text", variante.nome || "", indice);
    const preco = criarCampoVariante(campos, "Preço", "preco", "number", variante.preco, indice);
    if (produtoEmEdicao && produtoEmEdicao.somenteCopao) {
      preco.disabled = true;
      preco.placeholder = "Não se aplica";
    }
    const nomeInput = campos.querySelector('[data-variant-field="nome"]');
    const estoqueInput = criarCampoVariante(campos, "Estoque", "estoque", "number", variante.estoque === undefined ? 0 : variante.estoque, indice);
    const minimoInput = criarCampoVariante(campos, "Quantidade mínima", "minimo", "number", variante.minimo === undefined ? 0 : variante.minimo, indice);
    const disponibilidade = criarNo("label", "", "variant-availability");
    const ativo = document.createElement("input");
    ativo.type = "checkbox";
    ativo.dataset.variantField = "ativo";
    ativo.checked = variante.ativo !== false;
    disponibilidade.append(ativo, document.createTextNode(" Disponível para venda"));
    campos.append(disponibilidade);

    const remover = criarNo("button", "Remover opção", "button button-outline variant-remove");
    remover.type = "button";
    remover.addEventListener("click", () => {
      linha.remove();
      atualizarBotoesRemoverVariante();
    });
    linha.append(campos, remover);
    variantList.append(linha);
    nomeInput.addEventListener("input", atualizarCamposDerivados);
    estoqueInput.addEventListener("input", atualizarCamposDerivados);
    estoqueInput.addEventListener("change", () => {
      if (!produtoEmEdicao || !linha.dataset.variantId) return;
      try {
        storage.atualizarEstoqueVariante(produtoEmEdicao.id, linha.dataset.variantId, estoqueInput.value);
        estoqueInput.dataset.savedStock = estoqueInput.value;
        aviso.textContent = `Estoque de ${produtoEmEdicao.nome} salvo.`;
        atualizarPainel();
      } catch (erro) {
        estoqueInput.value = estoqueInput.dataset.savedStock;
        atualizarCamposDerivados();
        aviso.textContent = erro.message;
      }
    });
    minimoInput.addEventListener("change", () => {
      if (!produtoEmEdicao || !linha.dataset.variantId) return;
      try {
        storage.atualizarQuantidadeVariante(produtoEmEdicao.id, linha.dataset.variantId, {
          minimo: minimoInput.value
        });
        minimoInput.dataset.savedMinimum = minimoInput.value;
        aviso.textContent = `Quantidade mínima de ${produtoEmEdicao.nome} salva.`;
        atualizarPainel();
      } catch (erro) {
        minimoInput.value = minimoInput.dataset.savedMinimum;
        aviso.textContent = erro.message;
      }
    });
    atualizarCamposDerivados();
    atualizarBotoesRemoverVariante();
    return linha;
  }

  function abrirFormularioProduto(produto) {
    produtoEmEdicao = produto || null;
    stockForm.hidden = false;
    document.querySelector("#product-form-title").textContent = produto ? "Editar produto" : "Novo produto";
    document.querySelector("#product-id").value = produto ? produto.id : "";
    document.querySelector("#product-name").value = produto ? produto.nome : "";
    document.querySelector("#product-category").value = produto ? produto.categoria : "Bebidas";
    copaoCheckbox.checked = Boolean(produto && produto.permiteCopao);
    atualizarOpcaoCopaoPorCategoria();
    mixtureCheckbox.checked = Boolean(produto && produto.permiteMistura);
    restrictedCheckbox.checked = Boolean(produto && produto.restritoMaiores);
    beverageTypeSelect.value = produto ? produto.tipoBebida || "" : "";
    beverageTypeSelect.disabled = !copaoCheckbox.checked;
    variantHelp.textContent = produto && produto.somenteCopao
      ? "Estas opções guardam o estoque dos sabores de gelo; o valor do copão vem da bebida base."
      : "Cadastre preço e estoque separadamente para cada apresentação. Se houver Garrafa e Dose, o estoque da Dose será calculado automaticamente em 10 doses por garrafa.";
    variantList.replaceChildren();
    const variantes = produto && Array.isArray(produto.variantes) ? produto.variantes : [{}];
    variantes.forEach((variante) => adicionarLinhaVariante(variante));
    document.querySelector("#product-message").textContent = "";
    document.querySelector("#product-name").focus();
  }

  function atualizarOpcaoCopaoPorCategoria() {
    const categoria = document.querySelector("#product-category").value.trim().toLocaleLowerCase("pt-BR");
    const categoriasSemCopao = [
      "balas", "balas e chicletes", "chocolates", "biscoitos", "salgadinhos",
      "petiscos", "doces e petiscos", "festa e churrasco", "açaí",
      "complementos de açaí", "caldas de açaí", "acessórios e tabacaria",
      "extras para drinks"
    ];
    const bloquear = categoriasSemCopao.includes(categoria);
    copaoCheckbox.disabled = bloquear;
    beverageTypeSelect.disabled = bloquear || !copaoCheckbox.checked;
    if (bloquear) {
      copaoCheckbox.checked = false;
      beverageTypeSelect.value = "";
    }
  }

  document.querySelector("#product-category").addEventListener("input", atualizarOpcaoCopaoPorCategoria);

  function fecharFormularioProduto() {
    stockForm.reset();
    stockForm.hidden = true;
    produtoEmEdicao = null;
    document.querySelector("#product-message").textContent = "";
  }

  document.querySelector("#new-product").addEventListener("click", () => abrirFormularioProduto(null));
  copaoCheckbox.addEventListener("change", () => {
    beverageTypeSelect.disabled = !copaoCheckbox.checked;
    if (!copaoCheckbox.checked) beverageTypeSelect.value = "";
  });
  document.querySelector("#add-product-variant").addEventListener("click", () => {
    const linha = adicionarLinhaVariante();
    linha.querySelector('[data-variant-field="nome"]').focus();
  });
  document.querySelector("#cancel-product").addEventListener("click", fecharFormularioProduto);
  stockForm.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const mensagem = document.querySelector("#product-message");
    mensagem.textContent = "";
    const nome = document.querySelector("#product-name").value.trim();
    if (!nome) {
      mensagem.textContent = "Informe o nome do produto.";
      return;
    }
    const variantes = [...variantList.querySelectorAll(".variant-editor-row")].map((linha) => ({
      id: linha.dataset.variantId,
      nome: linha.querySelector('[data-variant-field="nome"]').value,
      preco: linha.querySelector('[data-variant-field="preco"]').value,
      estoque: linha.querySelector('[data-variant-field="estoque"]').value,
      minimo: linha.querySelector('[data-variant-field="minimo"]').value,
      ativo: linha.querySelector('[data-variant-field="ativo"]').checked
    }));
    if (!variantes.length || variantes.some((variante) => !variante.nome.trim())) {
      mensagem.textContent = "Informe a apresentação de cada opção de venda.";
      return;
    }
    if (copaoCheckbox.checked && !beverageTypeSelect.value) {
      mensagem.textContent = "Escolha o tipo da bebida para habilitá-la no copão.";
      beverageTypeSelect.focus();
      return;
    }
    if (variantes.some((variante) => variante.estoque === "" || variante.minimo === "")) {
      mensagem.textContent = "Informe o estoque e o mínimo de cada opção de venda.";
      return;
    }
    try {
      storage.salvarProduto({
        id: produtoEmEdicao ? produtoEmEdicao.id : "",
        nome,
        categoria: document.querySelector("#product-category").value,
        permiteCopao: copaoCheckbox.checked,
        tipoBebida: beverageTypeSelect.value,
        permiteMistura: mixtureCheckbox.checked,
        restritoMaiores: restrictedCheckbox.checked,
        variantes
      });
      fecharFormularioProduto();
      aviso.textContent = "Produto salvo.";
      atualizarPainel();
    } catch (erro) {
      mensagem.textContent = erro.message;
    }
  });

  document.querySelector("#order-status-filter").addEventListener("change", mostrarPedidos);
  document.querySelector("#order-date-filter").addEventListener("change", mostrarPedidos);
  document.querySelector("#stock-category-filter").addEventListener("change", mostrarEstoque);
  document.querySelector("#stock-search").addEventListener("input", mostrarEstoque);
  document.querySelector("#stock-only-low").addEventListener("change", mostrarEstoque);
  document.querySelector("#fill-demo-stock").addEventListener("click", () => {
    try {
      const quantidade = storage.preencherEstoqueDemonstracao();
      aviso.textContent = `${quantidade} produtos receberam 10 unidades para demonstração. Use "Restaurar dados de exemplo" para zerá-los.`;
      atualizarPainel();
    } catch (erro) {
      aviso.textContent = erro.message;
    }
  });
  document.querySelector("#restock-low").addEventListener("click", () => {
    if (!window.confirm("Adicionar 25 unidades às bebidas em falta e 10 unidades aos demais produtos em falta?")) return;
    try {
      const resultado = storage.reporProdutosEmFalta();
      aviso.textContent = `${resultado.unidadesAdicionadas} unidades adicionadas em ${resultado.produtosAlterados} produtos em falta.`;
      atualizarPainel();
    } catch (erro) {
      aviso.textContent = erro.message;
    }
  });
  document.querySelector("#toggle-category-active").addEventListener("click", () => {
    const categoria = document.querySelector("#stock-category-filter").value;
    if (!categoria) {
      aviso.textContent = "Selecione uma categoria para ativar ou desativar os produtos.";
      return;
    }
    const produtos = storage.buscarProdutos().filter((produto) => produto.categoria === categoria);
    if (!produtos.length) return;
    const ativar = produtos.every((produto) => produto.ativo === false);
    produtos.forEach((produto) => storage.salvarProduto({ ...produto, ativo: ativar }));
    aviso.textContent = `Produtos da categoria ${categoria} ${ativar ? "ativados" : "desativados"}.`;
    atualizarPainel();
  });
  document.querySelector("#restore-demo-data").addEventListener("click", () => {
    if (!window.confirm("Adicionar novamente os produtos e pedidos fictícios de exemplo?")) return;
    try {
      storage.restaurarDadosExemplo();
      storage.restaurarEstoqueDemonstracao();
      aviso.textContent = "Dados de exemplo restaurados. Seus dados não demonstrativos foram mantidos.";
      atualizarPainel();
    } catch (erro) {
      aviso.textContent = erro.message;
    }
  });

  document.querySelector("#export-sales").addEventListener("click", () => {
    const vendas = storage.buscarPedidos().filter((pedido) => pedido.status === "Entregue");
    const escapar = (valor) => `"${String(valor ?? "").replace(/"/g, '""')}"`;
    const linhas = [
      ["Pedido", "Data", "Status", "Itens", "Total"],
      ...vendas.map((pedido) => [
        pedido.id,
        pedido.criadoEm,
        pedido.status,
        pedido.itens.map((item) => `${item.nome}${item.variante ? ` — ${item.variante}` : ""} x${item.quantidade}`).join(" | "),
        pedido.total === null ? "[PREÇO A CONFIRMAR]" : pedido.total
      ])
    ];
    const csv = `\uFEFF${linhas.map((linha) => linha.map(escapar).join(";")).join("\r\n")}`;
    const arquivo = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(arquivo);
    const link = criarNo("a");
    link.href = url;
    link.download = "vendas-mydrink.csv";
    link.click();
    URL.revokeObjectURL(url);
    aviso.textContent = "Arquivo CSV de vendas preparado.";
  });

  document.querySelector("[data-manager-logout]").addEventListener("click", () => {
    storage.encerrarSessaoGestor();
    window.location.replace("gestor-login.html");
  });

  mostrarAba("overview");
  atualizarPainel();
})();
