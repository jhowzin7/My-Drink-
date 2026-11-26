// Simulação didática: a sessão e os dados do cliente existem somente neste navegador.
// Um sistema real precisaria validar identidade e armazenar dados em um servidor.
(function () {
  const storage = window.MyDrinkStorage;
  const message = document.querySelector("#profile-message");
  let cliente;

  try {
    cliente = storage.buscarClienteAtual();
  } catch (erro) {
    message.textContent = erro.message;
    return;
  }
  if (!cliente) {
    window.location.replace("auth.html?retorno=perfil.html");
    return;
  }

  const form = document.querySelector("#profile-form");
  const cpfInput = document.querySelector("#profile-cpf");
  const phoneInput = document.querySelector("#profile-phone");
  const photoInput = document.querySelector("#profile-photo");
  const photoPreview = document.querySelector("#profile-photo-preview");
  const photoInitials = document.querySelector("#profile-initials");
  const currentPasswordInput = document.querySelector("#profile-current-password");
  const newPasswordInput = document.querySelector("#profile-new-password");
  const confirmPasswordInput = document.querySelector("#profile-confirm-password");
  const ordersList = document.querySelector("#customer-orders");
  let cpfEditado = false;
  let fotoPendente = "";

  function formatarTelefone(valor) {
    const digitos = valor.replace(/\D/g, "").slice(0, 11);
    if (digitos.length <= 2) return digitos ? `(${digitos}` : "";
    if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
    if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }

  function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  }

  function validarCpf(cpf) {
    const digitos = cpf.replace(/\D/g, "");
    if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;
    const calcularDigito = (trecho, peso) => {
      const soma = [...trecho].reduce((total, digito, indice) => total + Number(digito) * (peso - indice), 0);
      const resto = (soma * 10) % 11;
      return resto === 10 ? 0 : resto;
    };
    return calcularDigito(digitos.slice(0, 9), 10) === Number(digitos[9])
      && calcularDigito(digitos.slice(0, 10), 11) === Number(digitos[10]);
  }

  async function criarHash(senha) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("Este navegador não oferece hash seguro. Não foi feita nenhuma alteração.");
    }
    const dados = new TextEncoder().encode(senha);
    const hash = await window.crypto.subtle.digest("SHA-256", dados);
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function mostrarCliente() {
    form.elements.name.value = cliente.nome;
    form.elements.displayName.value = cliente.nomeExibicao || "";
    form.elements.username.value = cliente.nomeUsuario || "";
    cpfInput.value = cpfEditado ? storage.formatarCpf(cliente.cpf) : storage.mascararCpf(cliente.cpf);
    cpfInput.readOnly = !cpfEditado;
    phoneInput.value = formatarTelefone(cliente.telefone);
    form.elements.email.value = cliente.email;
    form.elements.birthdate.value = cliente.dataNascimento || "";
    form.elements.address.value = cliente.endereco || "";
    const fotoAtual = fotoPendente || cliente.foto;
    photoPreview.hidden = !fotoAtual;
    if (fotoAtual) {
      photoPreview.src = fotoAtual;
      photoPreview.alt = `Foto de perfil de ${cliente.nome.split(/\s+/)[0]}`;
    } else {
      photoPreview.removeAttribute("src");
    }
    photoInitials.hidden = Boolean(fotoAtual);
    photoInitials.textContent = cliente.nome.trim().charAt(0).toUpperCase();
    currentPasswordInput.value = "";
    newPasswordInput.value = "";
    confirmPasswordInput.value = "";
    message.textContent = "";
  }

  function criarNo(tag, texto, classe) {
    const elemento = document.createElement(tag);
    if (texto) elemento.textContent = texto;
    if (classe) elemento.className = classe;
    return elemento;
  }

  function mostrarPedidos() {
    ordersList.replaceChildren();
    const pedidos = storage.buscarPedidosDoCliente(cliente.id);
    if (!pedidos.length) {
      ordersList.append(criarNo("p", "Você ainda não fez pedidos.", "empty-state"));
      return;
    }

    pedidos.forEach((pedido) => {
      const cartao = criarNo("article", "", "order-history-card");
      const cabecalho = criarNo("div", "", "order-history-heading");
      const titulo = criarNo("h3", `Pedido ${pedido.id}`);
      const status = criarNo("span", pedido.status, `status-pill status-${pedido.status.toLowerCase().replace(/\s+/g, "-")}`);
      cabecalho.append(titulo, status);
      const data = new Date(pedido.criadoEm);
      cartao.append(cabecalho, criarNo("p", `Data: ${Number.isNaN(data.getTime()) ? "Não informada" : data.toLocaleString("pt-BR")}`));
      const lista = document.createElement("ul");
      pedido.itens.forEach((item) => {
        const opcao = item.variante ? ` — ${item.variante}` : "";
        lista.append(criarNo("li", `${item.nome}${opcao} — ${item.quantidade} un.`));
      });
      cartao.append(lista);
      cartao.append(criarNo("p", `Total: ${pedido.total === null ? "[PREÇO A CONFIRMAR]" : pedido.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, "order-history-total"));
      ordersList.append(cartao);
    });
  }

  async function comprimirImagem(arquivo) {
    if (!arquivo.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
    if (arquivo.size > 10 * 1024 * 1024) throw new Error("A imagem precisa ter até 10 MB antes da compressão.");

    const url = URL.createObjectURL(arquivo);
    try {
      const imagem = new Image();
      imagem.src = url;
      await imagem.decode();
      const limite = 320;
      const escala = Math.min(1, limite / Math.max(imagem.naturalWidth, imagem.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
      canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
      const contexto = canvas.getContext("2d");
      if (!contexto) throw new Error("Não foi possível preparar a imagem neste navegador.");
      contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.78);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  document.querySelector("#edit-cpf").addEventListener("click", () => {
    cpfEditado = !cpfEditado;
    cpfInput.value = cpfEditado ? storage.formatarCpf(cliente.cpf) : storage.mascararCpf(cliente.cpf);
    cpfInput.readOnly = !cpfEditado;
    document.querySelector("#edit-cpf").textContent = cpfEditado ? "Manter CPF atual" : "Alterar CPF";
    message.textContent = cpfEditado ? "Para alterar o CPF, informe sua senha atual antes de salvar." : "";
    if (cpfEditado) cpfInput.focus();
  });

  cpfInput.addEventListener("input", () => {
    if (cpfEditado) cpfInput.value = storage.formatarCpf(cpfInput.value);
  });
  phoneInput.addEventListener("input", () => {
    phoneInput.value = formatarTelefone(phoneInput.value);
  });

  photoInput.addEventListener("change", async () => {
    const arquivo = photoInput.files[0];
    if (!arquivo) return;
    try {
      fotoPendente = await comprimirImagem(arquivo);
      photoPreview.src = fotoPendente;
      photoPreview.hidden = false;
      photoInitials.hidden = true;
      photoPreview.alt = "Prévia da nova foto de perfil";
      photoPreview.classList.add("has-photo");
      message.textContent = "Foto preparada. Salve as alterações para confirmar.";
    } catch (erro) {
      message.textContent = erro.message || "Não foi possível carregar esta imagem.";
      photoInput.value = "";
    }
  });

  document.querySelector("#cancel-profile").addEventListener("click", () => {
    cpfEditado = false;
    fotoPendente = "";
    document.querySelector("#edit-cpf").textContent = "Alterar CPF";
    photoInput.value = "";
    mostrarCliente();
  });

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    message.textContent = "";
    const nome = form.elements.name.value.trim();
    const nomeExibicao = form.elements.displayName.value.trim();
    const nomeUsuarioDigitado = form.elements.username.value.trim();
    const cpf = cpfEditado ? cpfInput.value.replace(/\D/g, "") : cliente.cpf;
    const telefone = phoneInput.value.replace(/\D/g, "");
    const email = form.elements.email.value.trim().toLowerCase();
    const dataNascimento = form.elements.birthdate.value;
    const senhaAtual = currentPasswordInput.value;
    const novaSenha = newPasswordInput.value;
    const confirmacao = confirmPasswordInput.value;
    const alterarSenha = Boolean(novaSenha || confirmacao);
    const cpfMudou = cpf !== cliente.cpf;

    if (nome.split(/\s+/).length < 2) {
      message.textContent = "Informe seu nome e sobrenome.";
      return;
    }
    if (nomeExibicao.length > 24) {
      message.textContent = "O nome de exibição pode ter até 24 caracteres.";
      return;
    }
    let nomeUsuario = cliente.nomeUsuario || "";
    if (nomeUsuarioDigitado) {
      try {
        nomeUsuario = storage.normalizarNomeUsuario(nomeUsuarioDigitado);
      } catch (erro) {
        message.textContent = erro.message;
        form.elements.username.focus();
        return;
      }
    } else if (cliente.nomeUsuario) {
      message.textContent = "O nome de usuário não pode ficar vazio.";
      form.elements.username.focus();
      return;
    }
    if (cpfMudou && !validarCpf(cpf)) {
      message.textContent = "Digite um CPF válido.";
      return;
    }
    if (telefone.length < 10 || telefone.length > 11) {
      message.textContent = "Digite um telefone com DDD.";
      return;
    }
    if (!validarEmail(email)) {
      message.textContent = "Digite um e-mail válido.";
      return;
    }
    if (!dataNascimento) {
      message.textContent = "Informe sua data de nascimento.";
      form.elements.birthdate.focus();
      return;
    }
    const nascimento = new Date(`${dataNascimento}T00:00:00`);
    if (Number.isNaN(nascimento.getTime()) || nascimento > new Date()) {
      message.textContent = "Informe uma data de nascimento válida.";
      form.elements.birthdate.focus();
      return;
    }
    if (alterarSenha && novaSenha.length < 6) {
      message.textContent = "A nova senha precisa ter pelo menos 6 caracteres.";
      return;
    }
    if (alterarSenha && novaSenha !== confirmacao) {
      message.textContent = "A confirmação da nova senha não confere.";
      return;
    }
    if ((cpfMudou || alterarSenha) && !senhaAtual) {
      message.textContent = "Informe sua senha atual para alterar CPF ou senha.";
      currentPasswordInput.focus();
      return;
    }

    try {
      const alteracoes = {
        nome,
        nomeExibicao,
        nomeUsuario,
        cpf,
        telefone,
        email,
        dataNascimento,
        endereco: form.elements.address.value.trim(),
        foto: fotoPendente || cliente.foto || ""
      };
      if (cpfMudou || alterarSenha) {
        if (await criarHash(senhaAtual) !== cliente.senhaHash) {
          message.textContent = "A senha atual não confere.";
          return;
        }
      }
      if (alterarSenha) alteracoes.senhaHash = await criarHash(novaSenha);
      cliente = storage.atualizarUsuario(cliente.id, alteracoes);
      cpfEditado = false;
      fotoPendente = "";
      photoInput.value = "";
      document.querySelector("#edit-cpf").textContent = "Alterar CPF";
      mostrarCliente();
      storage.atualizarMenuCliente();
      message.textContent = "Alterações salvas com sucesso.";
    } catch (erro) {
      message.textContent = erro.message || "Não foi possível salvar as alterações.";
    }
  });

  mostrarCliente();
  mostrarPedidos();
})();
