// Simulação didática: pedidos e estoque são gravados no localStorage deste navegador.
// Um sistema real precisa validar o estoque e o pagamento em um servidor.
const BLOQUEAR_PEDIDO_FECHADO = false;

(function () {
  const storage = window.MyDrinkStorage;
  let cliente;
  try {
    cliente = storage.buscarClienteAtual();
  } catch (erro) {
    window.location.replace("auth.html?retorno=pedido.html");
    return;
  }
  if (!cliente) {
    window.location.replace("auth.html?retorno=pedido.html");
    return;
  }

  const catalogo = document.querySelector("#order-catalog");
  const form = document.querySelector("#checkout-form");
  const resumo = document.querySelector("#checkout-summary");
  const totalElemento = document.querySelector("#checkout-total");
  const mensagem = document.querySelector("#checkout-message");
  const enderecoGrupo = document.querySelector("#delivery-address-group");
  const enderecoInput = document.querySelector("#delivery-address");
  const confirmacao = document.querySelector("#order-confirmation");
  const avisoHorario = document.querySelector("#store-closed-notice");
  const botaoFinalizar = form.querySelector('[type="submit"]');
  const copaoBase = document.querySelector("#copao-base");
  const copaoGelo = document.querySelector("#copao-ice");
  const copaoPreview = document.querySelector("#copao-preview");
  const copaoQuantidadeElemento = document.querySelector("#copao-quantity");
  const copaoMenos = document.querySelector("#copao-minus");
  const copaoMais = document.querySelector("#copao-plus");
  const copaoAdicionar = document.querySelector("#add-copao");
  const copaoFeedback = document.querySelector("#copao-feedback");
  const catalogSearch = document.querySelector("#catalog-search");
  const catalogCategoryButtons = document.querySelector("#catalog-category-buttons");
  const catalogOnlyAvailable = document.querySelector("#catalog-only-available");
  const ageConfirmation = document.querySelector("#age-confirmation");
  const ageConfirmed = document.querySelector("#age-confirmed");
  const catalogSyncStatus = document.querySelector("#catalog-sync-status");
  const selecao = new Map();
  const selecaoCopao = new Map();
  const variantesSelecionadas = new Map();
  const tiposBebida = {
    whisky: { nome: "Whisky", icone: "🥃" },
    gin: { nome: "Gin", icone: "🍸" },
    vodka: { nome: "Vodka", icone: "🍸" },
    aperitivo: { nome: "Aperitivo", icone: "🍷" },
    outro: { nome: "Outros", icone: "🥤" }
  };
  let todosProdutos = [];
  let produtos = [];
  let chaveBaseCopao = "";
  let varianteGeloCopaoId = "";
  let quantidadeCopao = 1;
  let categoriaCatalogo = "Todas";

  storage.prepararDadosExemplo();

  function atualizarAvisoHorario() {
    const status = storage.obterStatusFuncionamento();
    const lojaFechada = status.configurado && !status.aberto;
    avisoHorario.hidden = !lojaFechada;
    botaoFinalizar.disabled = BLOQUEAR_PEDIDO_FECHADO && lojaFechada;
  }

  function criarNo(tag, texto, classe) {
    const elemento = document.createElement(tag);
    if (texto) elemento.textContent = texto;
    if (classe) elemento.className = classe;
    return elemento;
  }

  function formatarMoeda(valor) {
    return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function chaveSelecao(produtoId, varianteId) {
    return JSON.stringify([produtoId, varianteId]);
  }

  function chaveSelecaoCopao(produtoId, varianteId, geloProdutoId, geloVarianteId) {
    return JSON.stringify([produtoId, varianteId, geloProdutoId, geloVarianteId]);
  }

  function decodificarChave(chave) {
    try {
      const partes = JSON.parse(chave);
      return Array.isArray(partes) ? partes : [];
    } catch (erro) {
      return [];
    }
  }

  function buscarProdutoVariante(produtoId, varianteId) {
    const produto = todosProdutos.find((item) => item.id === produtoId);
    const variante = produto && produto.variantes.find((item) => item.id === varianteId);
    return produto && variante ? { produto, variante } : null;
  }

  function estoqueCopaoSelecionado(produtoId, varianteId, geloProdutoId, geloVarianteId) {
    const base = buscarProdutoVariante(produtoId, varianteId);
    const gelo = buscarProdutoVariante(geloProdutoId, geloVarianteId);
    if (!base || !gelo) return 0;
    let baseNoCarrinho = 0;
    let geloNoCarrinho = 0;
    selecaoCopao.forEach((quantidade, chave) => {
      const [idBase, idVariante, idGelo, idVarianteGelo] = decodificarChave(chave);
      if (idBase === produtoId && idVariante === varianteId) baseNoCarrinho += quantidade;
      if (idGelo === geloProdutoId && idVarianteGelo === geloVarianteId) geloNoCarrinho += quantidade;
    });
    return Math.max(0, Math.min(
      base.variante.estoque - baseNoCarrinho,
      gelo.variante.estoque - geloNoCarrinho
    ));
  }

  function normalizarSelecao() {
    selecao.forEach((quantidade, chave) => {
      const [produtoId, varianteId] = JSON.parse(chave);
      const produto = produtos.find((item) => item.id === produtoId);
      const variante = produto && produto.variantes.find((item) => item.id === varianteId && item.ativo);
      if (!variante || variante.estoque < 1) selecao.delete(chave);
      else if (quantidade > variante.estoque) selecao.set(chave, variante.estoque);
    });
    variantesSelecionadas.forEach((varianteId, produtoId) => {
      const produto = produtos.find((item) => item.id === produtoId);
      const variante = produto && produto.variantes.find((item) => item.id === varianteId && item.ativo && item.estoque > 0);
      if (!variante) variantesSelecionadas.delete(produtoId);
    });

    const restanteBase = new Map();
    const restanteGelo = new Map();
    selecaoCopao.forEach((quantidade, chave) => {
      const [produtoId, varianteId, geloProdutoId, geloVarianteId] = decodificarChave(chave);
      const base = buscarProdutoVariante(produtoId, varianteId);
      const gelo = buscarProdutoVariante(geloProdutoId, geloVarianteId);
      if (!base || !gelo || !base.produto.ativo || !base.produto.permiteCopao
        || !base.variante.ativo || !gelo.produto.ativo || !gelo.produto.somenteCopao || !gelo.variante.ativo) {
        selecaoCopao.delete(chave);
        return;
      }
      const chaveBase = chaveSelecao(produtoId, varianteId);
      const chaveGelo = chaveSelecao(geloProdutoId, geloVarianteId);
      const limite = Math.max(0, Math.min(
        restanteBase.has(chaveBase) ? restanteBase.get(chaveBase) : base.variante.estoque,
        restanteGelo.has(chaveGelo) ? restanteGelo.get(chaveGelo) : gelo.variante.estoque
      ));
      const quantidadeValida = Math.min(quantidade, limite);
      if (!quantidadeValida) {
        selecaoCopao.delete(chave);
        return;
      }
      selecaoCopao.set(chave, quantidadeValida);
      restanteBase.set(chaveBase, (restanteBase.has(chaveBase) ? restanteBase.get(chaveBase) : base.variante.estoque) - quantidadeValida);
      restanteGelo.set(chaveGelo, (restanteGelo.has(chaveGelo) ? restanteGelo.get(chaveGelo) : gelo.variante.estoque) - quantidadeValida);
    });
  }

  function mostrarCatalogo(focoId) {
    todosProdutos = storage.buscarProdutos();
    produtos = todosProdutos.filter((produto) => produto.ativo && !produto.somenteCopao);
    normalizarSelecao();
    catalogo.replaceChildren();
    const termo = catalogSearch ? catalogSearch.value.trim().toLocaleLowerCase("pt-BR") : "";
    const apenasDisponiveis = catalogOnlyAvailable ? catalogOnlyAvailable.checked : true;
    produtos = produtos
      .filter((produto) => categoriaCatalogo === "Todas" || produto.categoria === categoriaCatalogo)
      .filter((produto) => !termo || produto.nome.toLocaleLowerCase("pt-BR").includes(termo))
      .filter((produto) => !apenasDisponiveis || produto.variantes.some((variante) => variante.ativo && variante.estoque > 0))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    if (!produtos.length) {
      catalogo.append(criarNo("p", "Nenhum produto encontrado.", "empty-state"));
      renderizarMontadorCopao();
      atualizarResumo();
      return;
    }
    if (!produtos.length) {
      catalogo.append(criarNo("p", "Nenhum produto está cadastrado no momento.", "empty-state"));
    } else produtos.forEach((produto, indiceProduto) => {
      const cartao = criarNo("article", "", "catalog-card");
      const informacoes = criarNo("div", "", "catalog-info");
      informacoes.append(
        criarNo("span", produto.categoria, "catalog-category"),
        criarNo("h3", produto.nome)
      );
      if (produto.restritoMaiores) {
        informacoes.append(criarNo("p", produto.avisoRestrito || "Venda proibida para menores de 18 anos", "restricted-product"));
      }
      const opcoesDisponiveis = produto.variantes.filter((variante) => {
        return variante.ativo && !(produto.permiteCopao && variante.nome.toLocaleLowerCase("pt-BR") === "copão");
      });
      const detalhes = criarNo("div", "", "catalog-details");
      const grupoOpcao = criarNo("div", "", "catalog-option");
      const rotuloOpcao = criarNo("label", `Opção de venda para ${produto.nome}`);
      const seletor = document.createElement("select");
      seletor.id = `catalog-option-${indiceProduto}`;
      seletor.setAttribute("aria-label", `Opção de venda para ${produto.nome}`);
      const instrucao = criarNo("option", "Selecione uma opção");
      instrucao.value = "";
      seletor.append(instrucao);
      opcoesDisponiveis.forEach((variante) => {
        const preco = variante.preco === null ? "[PREÇO A CONFIRMAR]" : formatarMoeda(variante.preco);
        const indisponivel = variante.estoque < 1;
        const medidas = storage.obterMedidasLoja();
        const descricaoVariacao = variante.nome.toLocaleLowerCase("pt-BR").startsWith("dose")
          ? `Dose em copo de ${medidas.dose.tamanhoCopoMl} ml`
          : variante.nome.toLocaleLowerCase("pt-BR") === "copão"
            ? `Copão de ${medidas.copao.tamanhoCopoMl} ml, energético e gelo saborizado incluídos`
            : variante.descricao || "";
        const descricao = descricaoVariacao ? ` — ${descricaoVariacao}` : "";
        const opcao = criarNo(
          "option",
          `${variante.nome} — ${preco}${descricao}${indisponivel ? " — Indisponível" : ""}`,
        );
        opcao.value = variante.id;
        opcao.disabled = indisponivel;
        seletor.append(opcao);
      });
      rotuloOpcao.htmlFor = seletor.id;
      grupoOpcao.append(rotuloOpcao, seletor);

      const varianteId = variantesSelecionadas.get(produto.id) || "";
      const varianteSelecionada = opcoesDisponiveis.find((variante) => variante.id === varianteId) || null;
      if (varianteSelecionada && varianteSelecionada.estoque > 0) seletor.value = varianteSelecionada.id;
      else variantesSelecionadas.delete(produto.id);

      const precoAtual = varianteSelecionada && varianteSelecionada.estoque > 0
        ? varianteSelecionada.preco === null ? "[PREÇO A CONFIRMAR]" : formatarMoeda(varianteSelecionada.preco)
        : "Selecione uma opção";
      const preco = criarNo("p", precoAtual, "catalog-price");
      const temEstoque = opcoesDisponiveis.some((variante) => variante.estoque > 0);
      const textoEstoque = varianteSelecionada && varianteSelecionada.estoque > 0
        ? `Disponível: ${varianteSelecionada.estoque}`
        : !opcoesDisponiveis.length
          ? "Nenhuma opção ativa"
          : temEstoque
            ? "Selecione uma opção"
            : "Indisponível";
      const estoque = criarNo(
        "span",
        textoEstoque,
        varianteSelecionada && varianteSelecionada.estoque > 0 ? "stock-label" : "stock-label is-empty"
      );
      detalhes.append(grupoOpcao, preco, estoque);

      const controle = criarNo("div", "", "quantity-control");
      const chave = varianteSelecionada ? chaveSelecao(produto.id, varianteSelecionada.id) : "";
      const quantidade = chave ? selecao.get(chave) || 0 : 0;
      const diminuir = criarNo("button", "−", "quantity-button");
      diminuir.type = "button";
      diminuir.disabled = quantidade === 0;
      diminuir.id = `catalog-minus-${indiceProduto}`;
      diminuir.setAttribute("aria-label", `Remover uma unidade de ${produto.nome}${varianteSelecionada ? ` — ${varianteSelecionada.nome}` : ""}`);
      const valor = criarNo("output", String(quantidade), "quantity-value");
      valor.setAttribute("aria-label", `Quantidade de ${produto.nome}${varianteSelecionada ? ` — ${varianteSelecionada.nome}` : ""}`);
      const aumentar = criarNo("button", "+", "quantity-button");
      aumentar.type = "button";
      aumentar.disabled = !varianteSelecionada || varianteSelecionada.estoque < 1 || quantidade >= varianteSelecionada.estoque;
      aumentar.id = `catalog-plus-${indiceProduto}`;
      aumentar.setAttribute("aria-label", `Adicionar uma unidade de ${produto.nome}${varianteSelecionada ? ` — ${varianteSelecionada.nome}` : ""}`);

      diminuir.addEventListener("click", () => alterarQuantidade(produto, varianteSelecionada, -1, diminuir.id));
      aumentar.addEventListener("click", () => alterarQuantidade(produto, varianteSelecionada, 1, aumentar.id));
      seletor.addEventListener("change", () => {
        if (seletor.value) variantesSelecionadas.set(produto.id, seletor.value);
        else variantesSelecionadas.delete(produto.id);
        mostrarCatalogo(seletor.id);
      });
      controle.append(diminuir, valor, aumentar);
      cartao.append(informacoes, detalhes, controle);
      catalogo.append(cartao);
    });
    renderizarMontadorCopao();
    atualizarResumo();
    const foco = focoId && document.getElementById(focoId);
    if (foco && !foco.disabled) foco.focus();
    else if (focoId) {
      const indice = focoId.split("-").pop();
      const seletor = document.getElementById(`catalog-option-${indice}`);
      if (seletor) seletor.focus();
    }
  }

  function configurarFiltrosCatalogo() {
    if (!catalogCategoryButtons) return;
    const categoriasDisponiveis = storage.obterCategoriasProdutos();
    if (categoriaCatalogo !== "Todas" && !categoriasDisponiveis.includes(categoriaCatalogo)) categoriaCatalogo = "Todas";
    const categorias = ["Todas", ...categoriasDisponiveis];
    catalogCategoryButtons.replaceChildren();
    categorias.forEach((categoria) => {
      const botao = criarNo("button", categoria, "catalog-category-button");
      botao.type = "button";
      botao.setAttribute("aria-pressed", String(categoriaCatalogo === categoria));
      botao.classList.toggle("is-active", categoriaCatalogo === categoria);
      botao.addEventListener("click", () => {
        categoriaCatalogo = categoria;
        configurarFiltrosCatalogo();
        mostrarCatalogo();
      });
      catalogCategoryButtons.append(botao);
    });
  }

  if (catalogSearch) catalogSearch.addEventListener("input", () => mostrarCatalogo());
  if (catalogOnlyAvailable) catalogOnlyAvailable.addEventListener("change", () => mostrarCatalogo());

  function obterSelecaoCopaoAtual() {
    const [produtoId, varianteId] = decodificarChave(copaoBase.value);
    const base = buscarProdutoVariante(produtoId, varianteId);
    const produtoGelo = todosProdutos.find((item) => item.somenteCopao && item.ativo);
    const varianteGelo = produtoGelo
      && produtoGelo.variantes.find((item) => item.id === copaoGelo.value);
    if (!base || !produtoGelo || !varianteGelo) return null;
    return { ...base, produtoGelo, varianteGelo };
  }

  function atualizarPreviewCopao() {
    const selecaoAtual = obterSelecaoCopaoAtual();
    const temSelecao = Boolean(selecaoAtual);
    const disponivel = temSelecao
      ? estoqueCopaoSelecionado(
        selecaoAtual.produto.id,
        selecaoAtual.variante.id,
        selecaoAtual.produtoGelo.id,
        selecaoAtual.varianteGelo.id
      )
      : 0;
    const precoValido = temSelecao
      && selecaoAtual.variante.preco !== null
      && Number.isFinite(Number(selecaoAtual.variante.preco))
      && Number(selecaoAtual.variante.preco) >= 0;

    if (disponivel > 0) quantidadeCopao = Math.min(quantidadeCopao, disponivel);
    copaoQuantidadeElemento.textContent = String(quantidadeCopao);
    copaoMenos.disabled = !temSelecao || disponivel < 1 || quantidadeCopao <= 1;
    copaoMais.disabled = !temSelecao || quantidadeCopao >= disponivel;
    copaoAdicionar.disabled = !temSelecao || !precoValido || quantidadeCopao > disponivel;

    if (!temSelecao) {
      copaoPreview.textContent = "Selecione uma bebida base e um sabor de gelo disponíveis.";
      return;
    }

    const precoAdicional = Number(selecaoAtual.varianteGelo.precoAdicional) || 0;
    const precoCopao = precoValido ? selecaoAtual.variante.preco + precoAdicional : null;
    const preco = precoValido ? formatarMoeda(precoCopao) : "[PREÇO A CONFIRMAR]";
    const adicionalTexto = precoAdicional > 0 ? ` (adicional do sabor: ${formatarMoeda(precoAdicional)})` : "";
    const iconeTipo = (tiposBebida[selecaoAtual.produto.tipoBebida] || tiposBebida.outro).icone;
    const medidas = storage.obterMedidasLoja();
    const resumoMedidas = `Copão de ${medidas.copao.tamanhoCopoMl} ml · energético ${medidas.copao.energeticoIncluso ? "incluso" : "opcional"}`;
    copaoPreview.textContent = disponivel > 0
      ? `${iconeTipo} ${selecaoAtual.produto.nome} com gelo de ${selecaoAtual.varianteGelo.nome} · ${resumoMedidas} · ${preco}${adicionalTexto} por copão · ${disponivel} disponível(is)`
      : `${selecaoAtual.produto.nome} com gelo de ${selecaoAtual.varianteGelo.nome} · Indisponível`;
  }

  function renderizarMontadorCopao() {
    const baseAnterior = chaveBaseCopao;
    copaoBase.replaceChildren(criarNo("option", "Selecione uma bebida", ""));
    copaoBase.firstElementChild.value = "";
    const grupos = new Map();
    const bebidas = todosProdutos
      .filter((produto) => produto.ativo && produto.permiteCopao && !produto.somenteCopao)
      .filter((produto) => {
        const categoria = String(produto.categoria || "").toLocaleLowerCase("pt-BR");
        return ![
          "balas", "balas e chicletes", "chocolates", "biscoitos", "salgadinhos",
          "petiscos", "doces e petiscos", "festa e churrasco", "açaí",
          "complementos de açaí", "caldas de açaí", "acessórios e tabacaria",
          "extras para drinks"
        ].includes(categoria);
      })
      .map((produto) => ({
        produto,
        variante: produto.variantes.find((item) => item.nome.toLocaleLowerCase("pt-BR") === "copão")
      }))
      .filter((item) => item.variante)
      .sort((a, b) => a.produto.nome.localeCompare(b.produto.nome, "pt-BR"));

    bebidas.forEach(({ produto, variante }) => {
      const tipo = tiposBebida[produto.tipoBebida] ? produto.tipoBebida : "outro";
      if (!grupos.has(tipo)) {
        const grupo = document.createElement("optgroup");
        grupo.label = `${tiposBebida[tipo].icone} ${tiposBebida[tipo].nome}`;
        grupos.set(tipo, grupo);
        copaoBase.append(grupo);
      }
      const preco = variante.preco === null ? "[PREÇO A CONFIRMAR]" : formatarMoeda(variante.preco);
      const indisponivel = !variante.ativo || variante.estoque < 1;
      const opcao = criarNo("option", `${produto.nome} — ${preco}${indisponivel ? " — Indisponível" : ""}`);
      opcao.value = chaveSelecao(produto.id, variante.id);
      opcao.disabled = indisponivel;
      grupos.get(tipo).append(opcao);
    });

    const produtoGelo = todosProdutos.find((produto) => produto.ativo && produto.somenteCopao);
    copaoGelo.replaceChildren(criarNo("option", "Selecione um sabor", ""));
    copaoGelo.firstElementChild.value = "";
    if (produtoGelo) {
      produtoGelo.variantes.forEach((variante) => {
        const indisponivel = !variante.ativo || variante.estoque < 1;
        const opcao = criarNo(
          "option",
          `${variante.nome}${indisponivel ? " — Indisponível" : ` — ${variante.estoque} disponível(is)`}`
        );
        opcao.value = variante.id;
        opcao.disabled = indisponivel;
        copaoGelo.append(opcao);
      });
    } else {
      const opcao = criarNo("option", "Sabores de gelo não cadastrados");
      opcao.disabled = true;
      copaoGelo.append(opcao);
    }

    chaveBaseCopao = [...copaoBase.options].some((opcao) => opcao.value === baseAnterior && !opcao.disabled)
      ? baseAnterior
      : "";
    varianteGeloCopaoId = [...copaoGelo.options].some((opcao) => {
      return opcao.value === varianteGeloCopaoId && !opcao.disabled;
    }) ? varianteGeloCopaoId : "";
    copaoBase.value = chaveBaseCopao;
    copaoGelo.value = varianteGeloCopaoId;
    atualizarPreviewCopao();
  }

  function alterarQuantidade(produto, variante, diferenca, focoId) {
    if (!variante || !variante.ativo) return;
    const chave = chaveSelecao(produto.id, variante.id);
    const quantidadeAtual = selecao.get(chave) || 0;
    const proxima = Math.max(0, Math.min(variante.estoque, quantidadeAtual + diferenca));
    if (proxima === 0) selecao.delete(chave);
    else selecao.set(chave, proxima);
    mostrarCatalogo(focoId);
  }

  function clienteTemMaioridade() {
    if (!cliente.dataNascimento) return false;
    const nascimento = new Date(`${cliente.dataNascimento}T00:00:00`);
    if (Number.isNaN(nascimento.getTime())) return false;
    const hoje = new Date();
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const aniversario = new Date(hoje.getFullYear(), nascimento.getMonth(), nascimento.getDate());
    if (hoje < aniversario) idade -= 1;
    return idade >= 18;
  }

  function pedidoPossuiProdutoRestrito(itens) {
    return itens.some(({ produtoId }) => {
      const produto = todosProdutos.find((item) => item.id === produtoId);
      return Boolean(produto && produto.restritoMaiores);
    });
  }

  function atualizarResumo() {
    const itensSelecionados = [];
    produtos.forEach((produto) => produto.variantes.forEach((variante) => {
      const quantidade = selecao.get(chaveSelecao(produto.id, variante.id)) || 0;
      if (quantidade) itensSelecionados.push({ produto, variante, quantidade });
    }));
    selecaoCopao.forEach((quantidade, chave) => {
      const [produtoId, varianteId, geloProdutoId, geloVarianteId] = decodificarChave(chave);
      const base = buscarProdutoVariante(produtoId, varianteId);
      const gelo = buscarProdutoVariante(geloProdutoId, geloVarianteId);
      if (base && gelo) {
        itensSelecionados.push({
          produto: base.produto,
          variante: base.variante,
          gelo: gelo.variante,
          quantidade
        });
      }
    });
    const itensRestritos = itensSelecionados.map((item) => ({ produtoId: item.produto.id }));
    if (ageConfirmation) ageConfirmation.hidden = !pedidoPossuiProdutoRestrito(itensRestritos);
    if (!itensSelecionados.length) {
      resumo.textContent = "Selecione produtos para começar.";
      totalElemento.textContent = "Total: R$ 0,00";
      return;
    }

    resumo.textContent = itensSelecionados
      .map(({ produto, variante, gelo, quantidade }) => {
        const geloTexto = gelo ? ` com gelo de ${gelo.nome}` : "";
        return `${produto.nome} — ${variante.nome}${geloTexto}: ${quantidade} un.`;
      })
      .join("\n");
    const precoPendente = itensSelecionados.some(({ variante }) => {
      return variante.preco === null || !Number.isFinite(Number(variante.preco));
    });
    if (precoPendente) {
      totalElemento.textContent = "Total: [PREÇO A CONFIRMAR]";
      return;
    }
    const total = itensSelecionados.reduce((soma, item) => {
      const adicionalGelo = item.gelo ? Number(item.gelo.precoAdicional) || 0 : 0;
      return soma + (item.variante.preco + adicionalGelo) * item.quantidade;
    }, 0);
    totalElemento.textContent = `Total: ${formatarMoeda(total)}`;
  }

  copaoBase.addEventListener("change", () => {
    chaveBaseCopao = copaoBase.value;
    quantidadeCopao = 1;
    copaoFeedback.textContent = "";
    atualizarPreviewCopao();
  });
  copaoGelo.addEventListener("change", () => {
    varianteGeloCopaoId = copaoGelo.value;
    quantidadeCopao = 1;
    copaoFeedback.textContent = "";
    atualizarPreviewCopao();
  });
  copaoMenos.addEventListener("click", () => {
    quantidadeCopao = Math.max(1, quantidadeCopao - 1);
    atualizarPreviewCopao();
  });
  copaoMais.addEventListener("click", () => {
    const atual = obterSelecaoCopaoAtual();
    if (!atual) return;
    const disponivel = estoqueCopaoSelecionado(
      atual.produto.id,
      atual.variante.id,
      atual.produtoGelo.id,
      atual.varianteGelo.id
    );
    quantidadeCopao = Math.min(disponivel, quantidadeCopao + 1);
    atualizarPreviewCopao();
  });
  copaoAdicionar.addEventListener("click", () => {
    const atual = obterSelecaoCopaoAtual();
    if (!atual) return;
    const disponivel = estoqueCopaoSelecionado(
      atual.produto.id,
      atual.variante.id,
      atual.produtoGelo.id,
      atual.varianteGelo.id
    );
    if (atual.variante.preco === null || !Number.isFinite(Number(atual.variante.preco))) {
      copaoFeedback.textContent = "O preço desta apresentação Copão ainda precisa ser preenchido pelo gestor.";
      return;
    }
    if (quantidadeCopao > disponivel || disponivel < 1) {
      copaoFeedback.textContent = "Não há estoque suficiente para esta combinação.";
      return;
    }
    const chave = chaveSelecaoCopao(
      atual.produto.id,
      atual.variante.id,
      atual.produtoGelo.id,
      atual.varianteGelo.id
    );
    selecaoCopao.set(chave, (selecaoCopao.get(chave) || 0) + quantidadeCopao);
    copaoFeedback.textContent = `${quantidadeCopao} copão(ões) adicionado(s) ao pedido.`;
    atualizarPreviewCopao();
    atualizarResumo();
  });

  form.querySelectorAll('input[name="delivery"]').forEach((opcao) => {
    opcao.addEventListener("change", () => {
      const entrega = form.elements.delivery.value === "Entrega";
      enderecoGrupo.hidden = !entrega;
      enderecoInput.required = entrega;
      if (entrega && !enderecoInput.value) enderecoInput.value = cliente.endereco || "";
    });
  });

  form.addEventListener("submit", (evento) => {
    evento.preventDefault();
    mensagem.textContent = "";
    const statusHorario = storage.obterStatusFuncionamento();
    if (BLOQUEAR_PEDIDO_FECHADO && statusHorario.configurado && !statusHorario.aberto) {
      mensagem.textContent = "A loja está fechada agora. Seu pedido poderá ser feito quando abrirmos.";
      return;
    }
    const itens = [...selecao.entries()].map(([chave, quantidade]) => {
      const [produtoId, varianteId] = JSON.parse(chave);
      return { produtoId, varianteId, quantidade };
    });
    selecaoCopao.forEach((quantidade, chave) => {
      const [produtoId, varianteId, geloProdutoId, geloVarianteId] = decodificarChave(chave);
      itens.push({ produtoId, varianteId, geloProdutoId, geloVarianteId, quantidade });
    });
    if (!itens.length) {
      mensagem.textContent = "Adicione ao menos um produto ao pedido.";
      return;
    }

    const tipoEntrega = form.elements.delivery.value;
    const endereco = tipoEntrega === "Entrega" ? enderecoInput.value.trim() : "";
    if (tipoEntrega === "Entrega" && !endereco) {
      mensagem.textContent = "Informe o endereço para entrega.";
      enderecoInput.focus();
      return;
    }

    if (pedidoPossuiProdutoRestrito(itens)) {
      if (!clienteTemMaioridade()) {
        mensagem.textContent = "Venda proibida para menores de 18 anos. Beba com moderação.";
        return;
      }
      if (!ageConfirmed || !ageConfirmed.checked) {
        mensagem.textContent = "Confirme que você tem 18 anos ou mais antes de finalizar.";
        if (ageConfirmed) ageConfirmed.focus();
        return;
      }
    }

    try {
      const pedido = storage.salvarPedido({
        clienteId: cliente.id,
        cliente: cliente.nome,
        telefone: cliente.telefone,
        itens,
        observacoes: document.querySelector("#order-notes").value.trim(),
        tipoEntrega,
        endereco,
        pagamento: form.elements.payment.value
      });
      mostrarConfirmacao(pedido);
    } catch (erro) {
      mensagem.textContent = erro.message || "Não foi possível finalizar seu pedido.";
    }
  });

  function mostrarConfirmacao(pedido) {
    form.hidden = true;
    document.querySelector("#catalog-title").hidden = true;
    catalogo.hidden = true;
    confirmacao.hidden = false;
    document.querySelector("#confirmation-number").textContent = `Número do pedido: ${pedido.id}`;
    document.querySelector("#confirmation-total").textContent = `Total: ${formatarMoeda(pedido.total)}`;
    const mensagemWhatsApp = [
      `Olá, My Drink! Meu pedido ${pedido.id}:`,
      ...pedido.itens.map((item) => `• ${item.nome}${item.variante ? ` — ${item.variante}` : ""}: ${item.quantidade} un. — ${formatarMoeda(item.precoUnitario * item.quantidade)}`),
      `Total: ${formatarMoeda(pedido.total)}`,
      `Recebimento: ${pedido.tipoEntrega}`,
      ...(pedido.endereco ? [`Endereço: ${pedido.endereco}`] : []),
      `Pagamento: ${pedido.pagamento}`,
      ...(pedido.observacoes ? [`Observações: ${pedido.observacoes}`] : [])
    ].join("\n");
    document.querySelector("#confirmation-whatsapp").href = storage.criarLinkWhatsApp(mensagemWhatsApp);
    confirmacao.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  try {
    storage.prepararDadosExemplo();
    if (cliente.endereco) enderecoInput.value = cliente.endereco;
    atualizarAvisoHorario();
    window.setInterval(atualizarAvisoHorario, 60_000);
    configurarFiltrosCatalogo();
    mostrarCatalogo();
    storage.ouvirCatalogo(() => {
      configurarFiltrosCatalogo();
      mostrarCatalogo();
      atualizarAvisoHorario();
    }, (estado) => {
      if (catalogSyncStatus) {
        catalogSyncStatus.textContent = estado.mensagem
          || (estado.status === "online" ? "Catálogo online" : "Carregando catálogo...");
      }
    });
  } catch (erro) {
    catalogo.textContent = erro.message || "Não foi possível carregar o catálogo.";
  }
})();
