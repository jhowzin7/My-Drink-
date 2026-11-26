// Simulação didática: as funções deste site rodam no navegador, sem servidor.
// Um sistema real precisaria de servidor, banco de dados e controles de segurança.
const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");
const navItems = document.querySelectorAll(".nav-links a");
const siteHeader = document.querySelector(".site-header");

function setMenuOpen(isOpen) {
  if (!menuToggle || !navLinks) return;
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
  navLinks.classList.toggle("is-open", isOpen);
}

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    setMenuOpen(!isOpen);
  });
  navItems.forEach((item) => item.addEventListener("click", () => setMenuOpen(false)));
}

const currentYear = document.querySelector("#current-year");
if (currentYear) currentYear.textContent = new Date().getFullYear();

function updateHeader() {
  if (siteHeader) siteHeader.classList.toggle("is-scrolled", window.scrollY > 24);
}

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

// Ignora destinos externos e acompanha somente âncoras de seções desta página.
const observedSections = [...navItems]
  .filter((item) => item.getAttribute("href").startsWith("#"))
  .map((item) => document.querySelector(item.getAttribute("href")))
  .filter(Boolean);

if ("IntersectionObserver" in window) {
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navItems.forEach((item) => {
        const isCurrent = item.getAttribute("href") === `#${entry.target.id}`;
        item.classList.toggle("is-active", isCurrent);
        if (isCurrent) item.setAttribute("aria-current", "location");
        else item.removeAttribute("aria-current");
      });
    });
  }, { rootMargin: "-30% 0px -60% 0px" });
  observedSections.forEach((section) => sectionObserver.observe(section));
}

// Revela conteúdo ao rolar; sem IntersectionObserver, ele continua visível.
const revealElements = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  revealElements.forEach((element) => revealObserver.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

// Exibe placeholders em fotos ausentes sem manter ícones de arquivo quebrado.
document.querySelectorAll(".image-frame img").forEach((image) => {
  const frame = image.closest(".image-frame");
  const galleryButton = image.closest(".gallery-trigger");
  const atualizarImagem = () => {
    const ausente = !image.naturalWidth;
    frame.classList.toggle("is-missing", ausente);
    if (galleryButton) galleryButton.disabled = ausente;
  };
  image.addEventListener("load", atualizarImagem);
  image.addEventListener("error", atualizarImagem);
  if (image.complete) atualizarImagem();
});

// Abre as fotos disponíveis em uma galeria com controles de teclado.
const lightbox = document.querySelector("#gallery-lightbox");
if (lightbox) {
  const lightboxImage = lightbox.querySelector(".lightbox-image");
  const lightboxCaption = lightbox.querySelector(".lightbox-caption");
  const galleryButtons = [...document.querySelectorAll(".gallery-trigger")];
  let currentPhotoIndex = 0;

  function showGalleryPhoto(index) {
    const disponiveis = galleryButtons.filter((button) => !button.disabled);
    if (!disponiveis.length) return;
    currentPhotoIndex = (index + disponiveis.length) % disponiveis.length;
    const imagem = disponiveis[currentPhotoIndex].querySelector("img");
    lightboxImage.src = imagem.src;
    lightboxImage.alt = imagem.alt;
    lightboxCaption.textContent = imagem.alt;
  }

  galleryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      const disponiveis = galleryButtons.filter((item) => !item.disabled);
      showGalleryPhoto(disponiveis.indexOf(button));
      lightbox.showModal();
    });
  });

  lightbox.querySelector(".lightbox-close").addEventListener("click", () => lightbox.close());
  lightbox.querySelector(".lightbox-prev").addEventListener("click", () => showGalleryPhoto(currentPhotoIndex - 1));
  lightbox.querySelector(".lightbox-next").addEventListener("click", () => showGalleryPhoto(currentPhotoIndex + 1));
  lightbox.addEventListener("click", (evento) => {
    if (evento.target === lightbox) lightbox.close();
  });
  lightbox.addEventListener("keydown", (evento) => {
    if (evento.key === "ArrowLeft") {
      evento.preventDefault();
      showGalleryPhoto(currentPhotoIndex - 1);
    } else if (evento.key === "ArrowRight") {
      evento.preventDefault();
      showGalleryPhoto(currentPhotoIndex + 1);
    }
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && lightbox.open) {
      evento.preventDefault();
      lightbox.close();
    }
  });
}

// Os botões de contato usam o número definido uma única vez em storage.js.
if (window.MyDrinkStorage) {
  const whatsapp = window.MyDrinkStorage.obterConfiguracaoLoja().whatsapp;
  document.querySelectorAll(".whatsapp-link").forEach((link) => {
    link.href = window.MyDrinkStorage.criarLinkWhatsApp("Olá, My Drink! Gostaria de saber mais.");
  });
  const numeroWhatsApp = String(whatsapp).match(/^55(\d{2})(\d{5})(\d{4})$/);
  if (!numeroWhatsApp) {
    console.error("A configuração do WhatsApp da loja está inválida.");
  } else {
    document.querySelectorAll("[data-whatsapp-number]").forEach((elemento) => {
      elemento.textContent = `+55 ${numeroWhatsApp[1]} ${numeroWhatsApp[2]}-${numeroWhatsApp[3]}`;
    });
  }
}

// Os links e o nome exibido do Instagram vêm da configuração central da loja.
if (window.MyDrinkStorage && typeof window.MyDrinkStorage.obterConfiguracaoLoja === "function") {
  const instagram = window.MyDrinkStorage.obterConfiguracaoLoja().instagram;
  if (instagram && instagram.usuario && instagram.link) {
    document.querySelectorAll("[data-instagram-link]").forEach((link) => {
      link.href = instagram.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
    document.querySelectorAll("[data-instagram-user]").forEach((elemento) => {
      elemento.textContent = instagram.usuario;
    });
  } else {
    console.error("A configuração do Instagram da loja está incompleta.");
  }
} else {
  console.error("Não foi possível carregar a configuração do Instagram da loja.");
}

// Configura o mapa e revela o endereço alternativo se o iframe não responder.
const mapa = document.querySelector("#store-map");
const planoBMapa = document.querySelector("#map-fallback");
if (mapa && planoBMapa && window.MyDrinkStorage) {
  const enderecoLoja = window.MyDrinkStorage.obterConfiguracaoLoja().endereco;
  const enderecoCodificado = encodeURIComponent(enderecoLoja);
  const linkDirecoes = `https://www.google.com/maps/search/?api=1&query=${enderecoCodificado}`;
  let mapaCarregado = false;

  document.querySelectorAll("[data-store-address]").forEach((elemento) => {
    elemento.textContent = enderecoLoja;
  });
  document.querySelectorAll("[data-map-directions]").forEach((link) => {
    link.href = linkDirecoes;
  });

  const temporizadorMapa = window.setTimeout(() => {
    if (mapaCarregado) return;
    mapa.hidden = true;
    planoBMapa.hidden = false;
  }, 6000);

  mapa.addEventListener("load", () => {
    mapaCarregado = true;
    window.clearTimeout(temporizadorMapa);
    mapa.hidden = false;
    planoBMapa.hidden = true;
  });
  mapa.addEventListener("error", () => {
    mapaCarregado = true;
    window.clearTimeout(temporizadorMapa);
    mapa.hidden = true;
    planoBMapa.hidden = false;
  });

  mapa.src = `https://maps.google.com/maps?q=${enderecoCodificado}&t=&z=17&ie=UTF8&iwloc=&output=embed`;
}

// Atualiza os selos com o horário de Brasília, compartilhado em storage.js.
function atualizarSelosFuncionamento() {
  const selos = [...document.querySelectorAll("[data-opening-status]")];
  if (!selos.length || !window.MyDrinkStorage) return;

  try {
    const status = window.MyDrinkStorage.obterStatusFuncionamento();
    selos.forEach((selo) => {
      selo.hidden = !status.configurado;
      selo.classList.toggle("is-open", status.configurado && status.aberto);
      selo.classList.toggle("is-closed", status.configurado && !status.aberto);
      if (!status.configurado) return;

      const titulo = status.horarioEstendido
        ? "Aberto até 3h"
        : status.aberto
          ? "Aberto agora"
          : "Fechado";
      const detalhe = status.horarioHoje === "Aberto até 3h" ? "" : ` · ${status.horarioHoje}`;
      selo.textContent = `${titulo}${detalhe}`;
    });
  } catch (erro) {
    console.error("Falha ao consultar o horário da loja.", erro);
    selos.forEach((selo) => {
      selo.hidden = false;
      selo.classList.remove("is-open");
      selo.classList.add("is-closed");
      selo.textContent = "Não foi possível consultar o horário.";
    });
  }
}

atualizarSelosFuncionamento();
if (document.querySelector("[data-opening-status]")) {
  window.setInterval(atualizarSelosFuncionamento, 60_000);
}
