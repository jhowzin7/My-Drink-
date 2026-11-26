// Simulação didática: usuários e sessões ficam no armazenamento deste navegador.
// Em um sistema real, autenticação e senhas devem ser tratados por um servidor.
const storage = window.MyDrinkStorage;
const tabButtons = document.querySelectorAll(".auth-tab");
const loginPanel = document.querySelector("#panel-login");
const registerPanel = document.querySelector("#panel-register");
const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");

function mostrarMensagem(elemento, mensagem) {
  elemento.textContent = mensagem;
}

function validarCpf(cpf) {
  const digitos = cpf.replace(/\D/g, "");
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;

  const calcularDigito = (trecho, pesoInicial) => {
    let soma = 0;
    for (let indice = 0; indice < trecho.length; indice += 1) {
      soma += Number(trecho[indice]) * (pesoInicial - indice);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const primeiro = calcularDigito(digitos.slice(0, 9), 10);
  const segundo = calcularDigito(digitos.slice(0, 10), 11);
  return primeiro === Number(digitos[9]) && segundo === Number(digitos[10]);
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function formatarTelefone(valor) {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 2) return digitos ? `(${digitos}` : "";
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

async function criarHash(senha) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error("Este navegador não oferece hash seguro. Abra a página em um contexto seguro para continuar.");
  }
  const dados = new TextEncoder().encode(senha);
  const hash = await window.crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function obterDestino() {
  const destino = new URLSearchParams(window.location.search).get("retorno");
  return ["pedido.html", "perfil.html"].includes(destino) ? destino : "index.html";
}

function selecionarAba(botao) {
    const mostrarCadastro = botao.id === "tab-register";
    tabButtons.forEach((aba) => {
      const ativa = aba === botao;
      aba.classList.toggle("is-active", ativa);
      aba.setAttribute("aria-selected", String(ativa));
      aba.tabIndex = ativa ? 0 : -1;
    });
    loginPanel.hidden = mostrarCadastro;
    registerPanel.hidden = !mostrarCadastro;
}

tabButtons.forEach((botao, indice) => {
  botao.addEventListener("click", () => selecionarAba(botao));
  botao.addEventListener("keydown", (evento) => {
    if (!["ArrowLeft", "ArrowRight"].includes(evento.key)) return;
    evento.preventDefault();
    const proximo = tabButtons[(indice + (evento.key === "ArrowRight" ? 1 : -1) + tabButtons.length) % tabButtons.length];
    selecionarAba(proximo);
    proximo.focus();
  });
});

document.querySelector("#register-cpf").addEventListener("input", (evento) => {
  evento.currentTarget.value = storage.formatarCpf(evento.currentTarget.value);
});

document.querySelector("#register-phone").addEventListener("input", (evento) => {
  evento.currentTarget.value = formatarTelefone(evento.currentTarget.value);
});

loginForm.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const mensagem = document.querySelector("#login-error");
  mostrarMensagem(mensagem, "");
  const dados = new FormData(loginForm);
  const credencial = String(dados.get("credential") || "").trim();
  const senha = String(dados.get("password") || "");
  if (!credencial || !senha) {
    mostrarMensagem(mensagem, "Preencha seu nome de usuário, e-mail ou CPF e a senha.");
    return;
  }

  try {
    const usuario = storage.buscarUsuarioPorCredencial(credencial);
    const hash = await criarHash(senha);
    if (!usuario || usuario.senhaHash !== hash) {
      mostrarMensagem(mensagem, "Nome de usuário, e-mail/CPF ou senha não conferem. Confira os dados e tente novamente.");
      return;
    }
    storage.iniciarSessaoCliente(usuario.id);
    window.location.href = obterDestino();
  } catch (erro) {
    mostrarMensagem(mensagem, erro.message || "Não foi possível entrar agora.");
  }
});

registerForm.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const mensagem = document.querySelector("#register-error");
  mostrarMensagem(mensagem, "");
  const dados = new FormData(registerForm);
  const nome = String(dados.get("name") || "").trim();
  let nomeUsuario;
  const cpf = String(dados.get("cpf") || "").replace(/\D/g, "");
  const telefone = String(dados.get("phone") || "").replace(/\D/g, "");
  const email = String(dados.get("email") || "").trim().toLowerCase();
  const dataNascimento = String(dados.get("birthdate") || "");
  const senha = String(dados.get("password") || "");
  const confirmacao = String(dados.get("confirm") || "");

  if (nome.split(/\s+/).length < 2) {
    mostrarMensagem(mensagem, "Informe seu nome e sobrenome.");
    return;
  }
  try {
    nomeUsuario = storage.normalizarNomeUsuario(dados.get("username"));
  } catch (erro) {
    mostrarMensagem(mensagem, erro.message);
    document.querySelector("#register-username").focus();
    return;
  }
  if (!validarCpf(cpf)) {
    mostrarMensagem(mensagem, "Digite um CPF válido.");
    return;
  }
  if (telefone.length < 10 || telefone.length > 11) {
    mostrarMensagem(mensagem, "Digite um telefone com DDD.");
    return;
  }
  if (!validarEmail(email)) {
    mostrarMensagem(mensagem, "Digite um endereço de e-mail válido.");
    return;
  }
  if (!dataNascimento) {
    mostrarMensagem(mensagem, "Informe sua data de nascimento.");
    return;
  }
  const nascimento = new Date(`${dataNascimento}T00:00:00`);
  if (Number.isNaN(nascimento.getTime()) || nascimento > new Date()) {
    mostrarMensagem(mensagem, "Informe uma data de nascimento válida.");
    return;
  }
  if (senha.length < 6) {
    mostrarMensagem(mensagem, "A senha precisa ter pelo menos 6 caracteres.");
    return;
  }
  if (senha !== confirmacao) {
    mostrarMensagem(mensagem, "As senhas não conferem.");
    return;
  }

  try {
    const senhaHash = await criarHash(senha);
    const usuario = storage.salvarUsuario({ nome, nomeUsuario, cpf, telefone, email, dataNascimento, senhaHash });
    storage.iniciarSessaoCliente(usuario.id);
    window.location.href = obterDestino();
  } catch (erro) {
    mostrarMensagem(mensagem, erro.message || "Não foi possível criar a conta.");
  }
});
