// Simulação didática: autenticação e dados vivem apenas neste navegador.
// Um sistema real precisa de servidor, banco de dados e controles de segurança.
(function () {
  const CHAVES = {
    usuarios: "mydrink.usuarios",
    pedidos: "mydrink.pedidos",
    produtos: "mydrink.produtos",
    sessaoCliente: "mydrink.sessaoCliente",
    sessaoGestor: "mydrink.sessaoGestor",
    tema: "mydrink.tema"
  };

  const CHAVE_CATALOGO_VARIANTES = "mydrink.catalogoVariantesV1";
  const CHAVE_CATALOGO_COPAO = "mydrink.catalogoCopaoV1";
  const CHAVE_CATALOGO_EXPANDIDO = "mydrink.catalogoExpandidoV2";
  const CHAVE_ESTOQUE_DEMO = "mydrink.estoqueDemonstracao";
  const CHAVE_MEDIDAS_LOJA = "mydrink.medidasLoja";
  const DOSES_POR_GARRAFA = 10;
  const COPAO_CONFIG_PADRAO = {
    tamanhoCopoMl: 700,
    energeticoIncluso: true,
    bebidaNoCopaoMl: null
  };
  const DOSE_CONFIG_PADRAO = { tamanhoCopoMl: 200 };
  const CHAVE_HORARIO_ESTENDIDO = "mydrink.horarioEstendido";
  const CONFIGURACAO_LOJA = {
    endereco: "Avenida JK, 134 – Centro, Betim – MG",
    horarios: {
      fuso: "America/Sao_Paulo",
      dias: {
        0: null,
        1: { abre: "09:00", fecha: "20:00" },
        2: { abre: "09:00", fecha: "20:00" },
        3: { abre: "09:00", fecha: "20:00" },
        4: { abre: "09:00", fecha: "20:00" },
        5: { abre: "09:00", fecha: "20:00" },
        6: { abre: "09:00", fecha: "20:00" }
      }
    },
    whatsapp: "5531995053028",
    instagram: {
      usuario: "@mydrinkbetim",
      link: "https://www.instagram.com/mydrinkbetim/"
    }
  };
  const STATUS_PEDIDO = ["Recebido", "Em preparo", "Pronto", "Entregue", "Cancelado"];
  const FUSO_HORARIO_LOJA = CONFIGURACAO_LOJA.horarios.fuso;
  const HORARIOS_FUNCIONAMENTO = CONFIGURACAO_LOJA.horarios.dias;
  const DIAS_SEMANA = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  function dadosDataBrasilia(data = new Date()) {
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: FUSO_HORARIO_LOJA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(data).reduce((resultado, parte) => {
      resultado[parte.type] = parte.value;
      return resultado;
    }, {});
    return {
      data: `${partes.year}-${partes.month}-${partes.day}`,
      dia: DIAS_SEMANA[partes.weekday],
      minutos: Number(partes.hour) * 60 + Number(partes.minute)
    };
  }

  function deslocarData(data, deslocamento) {
    const [ano, mes, dia] = data.split("-").map(Number);
    return new Date(Date.UTC(ano, mes - 1, dia + deslocamento)).toISOString().slice(0, 10);
  }

  function minutosHorario(valor) {
    if (typeof valor !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) return null;
    const [hora, minuto] = valor.split(":").map(Number);
    return hora * 60 + minuto;
  }

  function formatarHora(valor) {
    return `${Number(valor.slice(0, 2))}h${valor.slice(3) === "00" ? "" : valor.slice(3)}`;
  }

  function obterStatusFuncionamento(agora = new Date()) {
    const momento = dadosDataBrasilia(agora);
    const dataAnterior = deslocarData(momento.data, -1);
    const dataEstendida = localStorage.getItem(CHAVE_HORARIO_ESTENDIDO);
    const estendidoHoje = dataEstendida === momento.data;
    const estendidoAnterior = dataEstendida === dataAnterior && momento.minutos < 180;
    const horarioHoje = HORARIOS_FUNCIONAMENTO[momento.dia];

    if (estendidoAnterior) {
      return {
        configurado: true,
        aberto: true,
        horarioHoje: "Aberto até 3h",
        horarioEstendido: true,
        horarioEstendidoAtivo: true,
        dataEstendida
      };
    }

    if (!horarioHoje) {
      return {
        configurado: false,
        aberto: false,
        horarioHoje: "Domingo: [HORÁRIO DE DOMINGO A CONFIRMAR]",
        horarioEstendido: false,
        horarioEstendidoAtivo: estendidoHoje,
        dataEstendida: estendidoHoje ? dataEstendida : null
      };
    }

    const abertura = minutosHorario(horarioHoje.abre);
    const fechamento = minutosHorario(horarioHoje.fecha);
    if (abertura === null || fechamento === null) {
      throw new Error("Os horários de funcionamento precisam usar o formato HH:MM.");
    }

    const abertoNoHorarioNormal = momento.minutos >= abertura && momento.minutos < fechamento;
    const abertoNoHorarioEstendido = estendidoHoje && momento.minutos >= fechamento;
    const aberto = abertoNoHorarioNormal || abertoNoHorarioEstendido;
    const horarioEstendido = aberto && estendidoHoje;
    const dias = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

    return {
      configurado: true,
      aberto,
      horarioHoje: `${dias[momento.dia]}: ${formatarHora(horarioHoje.abre)} às ${formatarHora(horarioHoje.fecha)}`,
      horarioEstendido,
      horarioEstendidoAtivo: estendidoHoje,
      dataEstendida: estendidoHoje ? dataEstendida : null
    };
  }

  function definirHorarioEstendidoHoje(ativar) {
    if (typeof ativar !== "boolean") throw new Error("Informe se o horário estendido deve ficar ativo.");
    if (ativar) {
      const status = obterStatusFuncionamento();
      if (!HORARIOS_FUNCIONAMENTO[dadosDataBrasilia().dia] && !status.horarioEstendidoAtivo) {
        throw new Error("O horário de domingo ainda precisa ser confirmado antes de ativar o horário estendido.");
      }
      localStorage.setItem(CHAVE_HORARIO_ESTENDIDO, dadosDataBrasilia().data);
    } else {
      const status = obterStatusFuncionamento();
      if (status.dataEstendida) localStorage.removeItem(CHAVE_HORARIO_ESTENDIDO);
    }
    return obterStatusFuncionamento();
  }

  // Aplica o tema salvo ou a preferência do sistema antes de carregar o CSS.
  try {
    const temaSalvo = localStorage.getItem(CHAVES.tema);
    const temaInicial = temaSalvo === "light" || temaSalvo === "dark"
      ? temaSalvo
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = temaInicial;
  } catch (error) {
    document.documentElement.dataset.theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function criarProdutoInicial(id, nome, categoria, nomesVariantes, campos = {}) {
    const variantes = campos.variantes || nomesVariantes.map((nomeVariante, indice) => ({
      id: `${id}-opcao-${indice + 1}`,
      nome: nomeVariante,
      preco: null,
      estoque: 0,
      minimo: 0,
      ativo: true
    }));
    return {
      id,
      nome,
      categoria,
      ativo: true,
      ...campos,
      variantes
    };
  }

  const produtosExemplo = [
    criarProdutoInicial("demo-bebida", "Bebida (exemplo)", "Bebidas", ["Unidade"], {
      variantes: [{ id: "demo-bebida-unidade", nome: "Unidade", preco: null, estoque: 8, minimo: 3, ativo: true }],
      exemplo: true
    }),
    criarProdutoInicial("demo-gelo", "Gelo (exemplo)", "Gelos", ["Pacote"], {
      variantes: [{ id: "demo-gelo-pacote", nome: "Pacote", preco: null, estoque: 12, minimo: 4, ativo: true }],
      exemplo: true
    }),
    criarProdutoInicial("demo-acai", "Açaí (exemplo)", "Açaí", ["Unidade"], {
      variantes: [{ id: "demo-acai-unidade", nome: "Unidade", preco: null, estoque: 5, minimo: 2, ativo: true }],
      exemplo: true
    }),
    criarProdutoInicial("demo-outro", "Outro produto (exemplo)", "Outros", ["Unidade"], {
      variantes: [{ id: "demo-outro-unidade", nome: "Unidade", preco: null, estoque: 0, minimo: 2, ativo: true }],
      exemplo: true
    })
  ];

  const bebidasComDose = [
    ["gin-eternity", "Gin Eternity", "gin"],
    ["white-horse", "White Horse", "whisky"],
    ["jack-daniels", "Jack Daniel's", "whisky"],
    ["red-label", "Red Label", "whisky"],
    ["busca-brisa", "Busca Brisa", "outro"],
    ["gin-rocks", "Gin Rocks", "gin"],
    ["campari", "Campari", "aperitivo"],
    ["vodka", "Vodka [MARCA A CONFIRMAR]", "vodka"]
  ].map(([id, nome, tipoBebida]) => criarProdutoInicial(
    id,
    nome,
    "Bebidas",
    ["Copão", "Garrafa", "Dose"],
    { catalogoInicial: true, permiteCopao: true, tipoBebida }
  ));

  const produtoGeloCopaoInicial = criarProdutoInicial(
    "gelo-copao",
    "Gelo para copão",
    "Gelos",
    ["Melancia", "Coco", "Uva verde", "Maracujá", "Morango", "Limão"],
    { catalogoInicial: true, somenteCopao: true }
  );

  const cigarrosComApresentacao = [
    ["porto-faria", "Porto Faria"],
    ["lucky-strike", "Lucky Strike"],
    ["san-marino", "San Marino"],
    ["marlboro", "Marlboro"],
    ["dunhill-carlton", "Dunhill-Carlton"],
    ["kent", "Kent"],
    ["camel", "Camel"],
    ["winston", "Winston"],
    ["chesterfield", "Chesterfield"],
    ["paulistinha", "Paulistinha"]
  ].map(([id, nome]) => criarProdutoInicial(id, nome, "Cigarros", ["Picado", "Maço"], { catalogoInicial: true }));

  const produtosCatalogoInicial = [
    ...bebidasComDose,
    ...cigarrosComApresentacao,
    criarProdutoInicial("souza-paiol", "Souza Paiol", "Cigarros", ["Apresentação a confirmar"], { catalogoInicial: true }),
    criarProdutoInicial("piracanjuba", "Piracanjuba", "Cigarros", ["Apresentação a confirmar"], { catalogoInicial: true }),
    criarProdutoInicial("bala-macia-coyote", "Bala macia Coyote", "Balas", ["Unidade"], { catalogoInicial: true }),
    ...[
      ["gulao", "Gulão"],
      ["doritos", "Doritos"],
      ["ruffles", "Ruffles"],
      ["cheetos", "Cheetos"],
      ["fandangos", "Fandangos"],
      ["baconzitos", "Baconzitos"]
    ].map(([id, nome]) => criarProdutoInicial(id, nome, "Salgadinhos", ["Pacote"], { catalogoInicial: true })),
    criarProdutoInicial("amendoim-japones", "Amendoim Japonês", "Amendoins", [
      "Helena (Mendorato)",
      "Dori (Pettiz)",
      "Yoki"
    ], { catalogoInicial: true }),
    criarProdutoInicial("crokissimo", "Crokíssimo", "Amendoins", ["Helena (Crokíssimo)"], { catalogoInicial: true }),
    criarProdutoInicial("ovinho", "Ovinho", "Amendoins", ["Pacote (marca a confirmar)"], { catalogoInicial: true }),
    criarProdutoInicial("amendoim-torrado-salgado", "Amendoim Torrado e Salgado", "Amendoins", ["Pacote"], { catalogoInicial: true }),
    ...[
      ["coca-cola", "Coca-Cola", ["Garrafa", "Lata", "600 ml", "Retornável"]],
      ["sprite", "Sprite", ["Garrafa", "Lata", "600 ml"]],
      ["fanta", "Fanta", ["Garrafa", "Lata", "600 ml", "Retornável"]],
      ["guarapan", "Guarapan", ["Garrafa", "Lata", "600 ml"]],
      ["sukita", "Sukita", ["Garrafa", "Lata", "600 ml"]]
    ].map(([id, nome, variantes]) => criarProdutoInicial(id, nome, "Refrigerantes", variantes, { catalogoInicial: true }))
  ];

  // Catálogo ampliado em uma única estrutura. Todos os preços começam sem confirmação.
  function produtoCatalogo(id, nome, categoria, nomesVariantes, campos = {}) {
    const variantes = nomesVariantes.map((nomeVariante) => {
      const descricao = nomeVariante.startsWith("Dose ")
        ? `Dose em copo de ${obterMedidasLoja().dose.tamanhoCopoMl} ml`
        : nomeVariante === "Copão"
          ? `Copão de ${obterMedidasLoja().copao.tamanhoCopoMl} ml, energético e gelo saborizado incluídos`
          : "";
      return {
        id: `${id}-${nomeVariante.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
        nome: nomeVariante,
        descricao,
        preco: null,
        estoque: 0,
        minimo: 0,
        ativo: true
      };
    });
    return {
      id,
      nome,
      categoria,
      ativo: true,
      catalogoInicial: false,
      restritoMaiores: false,
      permiteCopao: false,
      permiteMistura: false,
      tipoBebida: "",
      variantes,
      ...campos
    };
  }

  function obterMedidasLoja() {
    const salva = lerListaOpcional(CHAVE_MEDIDAS_LOJA);
    return {
      copao: {
        ...COPAO_CONFIG_PADRAO,
        ...(salva && salva.copao ? salva.copao : {})
      },
      dose: {
        ...DOSE_CONFIG_PADRAO,
        ...(salva && salva.dose ? salva.dose : {})
      }
    };
  }

  function lerListaOpcional(chave) {
    const conteudo = localStorage.getItem(chave);
    if (!conteudo) return null;
    try {
      return JSON.parse(conteudo);
    } catch (erro) {
      return null;
    }
  }

  function salvarMedidasLoja(medidas) {
    const atual = obterMedidasLoja();
    const novas = {
      copao: {
        tamanhoCopoMl: Number(medidas.copao.tamanhoCopoMl) || atual.copao.tamanhoCopoMl,
        energeticoIncluso: Boolean(medidas.copao.energeticoIncluso),
        bebidaNoCopaoMl: medidas.copao.bebidaNoCopaoMl === ""
          ? null
          : medidas.copao.bebidaNoCopaoMl === null
            ? null
            : Number(medidas.copao.bebidaNoCopaoMl) || null
      },
      dose: {
        tamanhoCopoMl: Number(medidas.dose.tamanhoCopoMl) || atual.dose.tamanhoCopoMl
      }
    };
    localStorage.setItem(CHAVE_MEDIDAS_LOJA, JSON.stringify(novas));
    return novas;
  }

  function lerProdutos() {
    return lerLista(CHAVES.produtos, "produtos");
  }

  const produtosCatalogoExpandido = [];

  ["Skol", "Brahma", "Antarctica", "Itaipava", "Heineken", "Budweiser", "Amstel", "Stella Artois",
    "Original", "Crystal", "Corona", "Spaten", "Eisenbahn", "Bohemia", "Schin", "Devassa", "Petra", "Império"
  ].forEach((nome) => {
    produtosCatalogoExpandido.push(produtoCatalogo(
      `cerveja-${nome.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}`,
      nome,
      "Cervejas",
      ["Lata 350 ml", "Latão 473 ml", "Long neck", "Garrafa 600 ml", "Litrão 1 L", "Caixa/fardo [QUANTIDADE A CONFIRMAR]"],
      { restritoMaiores: true }
    ));
  });

  function adicionarDestilados(lista, categoriaTipo, permiteCopao) {
    lista.forEach(({ id, nome, tipo }) => {
      produtosCatalogoExpandido.push(produtoCatalogo(
        id,
        nome,
        "Destilados",
        permiteCopao
          ? [`Dose (copo de ${obterMedidasLoja().dose.tamanhoCopoMl} ml)`, "Copão", "Garrafa"]
          : [`Dose (copo de ${obterMedidasLoja().dose.tamanhoCopoMl} ml)`, "Garrafa"],
        { restritoMaiores: true, permiteCopao, tipoBebida: tipo }
      ));
    });
  }

  adicionarDestilados([
    ["whisky-jack-daniels-honey", "Jack Daniel's Honey", "whisky"],
    ["whisky-jack-daniels-fire", "Jack Daniel's Fire", "whisky"],
    ["whisky-jack-daniels-maca-verde", "Jack Daniel's Maçã Verde", "whisky"],
    ["whisky-johnnie-walker-red-label", "Johnnie Walker Red Label", "whisky"],
    ["whisky-johnnie-walker-black-label", "Johnnie Walker Black Label", "whisky"],
    ["whisky-ballantines", "Ballantine's", "whisky"],
    ["whisky-passport", "Passport", "whisky"],
    ["whisky-chanceller", "Chanceller", "whisky"],
    ["whisky-royal-blue", "Royal Blue", "whisky"],
    ["whisky-chivas-regal", "Chivas Regal", "whisky"],
    ["whisky-old-parr", "Old Parr", "whisky"],
    ["whisky-teacher", "Teacher's", "whisky"],
    ["whisky-jim-beam", "Jim Beam", "whisky"],
    ["gin-gordons", "Gordon's", "gin"],
    ["gin-gordons-pink", "Gordon's Pink", "gin"],
    ["gin-beefeater", "Beefeater", "gin"],
    ["gin-beefeater-pink", "Beefeater Pink", "gin"],
    ["gin-tanqueray", "Tanqueray", "gin"],
    ["gin-bombay-sapphire", "Bombay Sapphire", "gin"],
    ["gin-seagers", "Seagers", "gin"],
    ["gin-bulldog", "Bulldog", "gin"],
    ["gin-intencion", "Intencion", "gin"],
    ["gin-kyrios", "Kyrios", "gin"],
    ["gin-dober", "Döber", "gin"],
    ["vodka-smirnoff", "Smirnoff", "vodka"],
    ["vodka-absolut", "Absolut", "vodka"],
    ["vodka-orloff", "Orloff", "vodka"],
    ["vodka-askov", "Askov", "vodka"],
    ["vodka-ciroc", "Ciroc", "vodka"],
    ["vodka-ciroc-red-berry", "Ciroc Red Berry", "vodka"],
    ["vodka-ketel-one", "Ketel One", "vodka"],
    ["vodka-skyy", "Skyy", "vodka"],
    ["vodka-leonoff", "Leonoff", "vodka"],
    ["vodka-hype", "Hype", "vodka"]
  ].map(([id, nome, tipo]) => ({ id, nome, tipo })), "", true);

  adicionarDestilados([
    ["rum-bacardi", "Bacardi", "rum"],
    ["rum-montilla", "Montilla", "rum"],
    ["cachaca-51", "51", "cachaça"],
    ["cachaca-ypiocca", "Ypióca", "cachaça"],
    ["cachaca-pitu", "Pitú", "cachaça"],
    ["cachaca-velho-barreiro", "Velho Barreiro", "cachaça"],
    ["cachaca-sagatiba", "Sagatiba", "cachaça"],
    ["cachaca-salinas", "Salinas", "cachaça"],
    ["outros-jose-cuervo", "Jose Cuervo", "outro"],
    ["outros-sierra", "Sierra", "outro"],
    ["outros-jagermeister", "Jägermeister", "outro"],
    ["outros-aperol", "Aperol", "outro"],
    ["outros-fernet-branca", "Fernet Branca", "outro"],
    ["outros-martini", "Martini", "outro"],
    ["outros-baileys", "Baileys", "outro"],
    ["outros-amarula", "Amarula", "outro"]
  ].map(([id, nome, tipo]) => ({ id, nome, tipo })), "", false);

  [
    ["vinho-sangue-de-boi", "Vinho de mesa Sangue de Boi"],
    ["vinho-cancao", "Vinho de mesa Canção"],
    ["vinho-pergola", "Vinho de mesa Pérgola"],
    ["vinho-salton", "Salton"],
    ["vinho-aurora", "Aurora"],
    ["espumante-chandon", "Espumante Chandon"],
    ["espumante-freixenet", "Espumante Freixenet"],
    ["vinho-prosecco", "Prosecco"],
    ["sidra-cereser", "Sidra Cereser"]
  ].forEach(([id, nome]) => produtosCatalogoExpandido.push(
    produtoCatalogo(id, nome, "Vinhos e espumantes", ["Garrafa 750 ml"], { restritoMaiores: true })
  ));

  [
    ["bebida-smirnoff-ice", "Smirnoff Ice", ["Unidade", "Pack [QUANTIDADE A CONFIRMAR]"]],
    ["bebida-skol-beats-senses", "Skol Beats Senses", ["Unidade", "Pack [QUANTIDADE A CONFIRMAR]"]],
    ["bebida-skol-beats-gt", "Skol Beats GT", ["Unidade", "Pack [QUANTIDADE A CONFIRMAR]"]],
    ["bebida-keep-cooler", "Keep Cooler", ["Unidade", "Pack [QUANTIDADE A CONFIRMAR]"]],
    ["bebida-corote", "Corote", ["Unidade", "Pack [QUANTIDADE A CONFIRMAR]"]],
    ["bebida-caipirinha-pronta", "Caipirinha pronta", ["Unidade", "Pack [QUANTIDADE A CONFIRMAR]"]],
    ["bebida-caipirinha-vodka-limao", "Caipirinha de vodka com limão", ["Copo 700 ml", "Pack [QUANTIDADE A CONFIRMAR]"]]
  ].forEach(([id, nome, variacoes]) => produtosCatalogoExpandido.push(
    produtoCatalogo(id, nome, "Bebidas prontas", variacoes, { restritoMaiores: true })
  ));

  const variacoesEnergeticos = ["Lata 250 ml", "Lata 473 ml", "Zero açúcar", "Pack 4 unidades"];
  ["Red Bull", "Monster", "Baly", "Fusion", "TNT", "Flying Horse", "Burn", "NOS"].forEach((nome) => {
    let variacoes = [...variacoesEnergeticos];
    if (["Baly", "Fusion"].includes(nome)) variacoes.push("Garrafa 2 L");
    if (["Baly", "Monster"].includes(nome)) variacoes.push("Maçã verde [CONFIRMAR SABORES]", "Melancia [CONFIRMAR SABORES]", "Tropical [CONFIRMAR SABORES]");
    const id = `energetico-${nome.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}`;
    produtosCatalogoExpandido.push(produtoCatalogo(id, nome, "Energéticos e misturas", variacoes, { permiteMistura: true }));
  });
  [
    ["mistura-agua-tonica", "Água tônica"],
    ["mistura-soda", "Soda"],
    ["mistura-h2o-limoneto", "H2O Limoneto"],
    ["mistura-suco-limao", "Suco de limão"]
  ].forEach(([id, nome]) => produtosCatalogoExpandido.push(
    produtoCatalogo(id, nome, "Energéticos e misturas", ["Unidade", "Garrafa"], { permiteMistura: true })
  ));
  produtosCatalogoExpandido.push(produtoCatalogo("extra-limao", "Limão", "Extras para drinks", ["Unidade"]));
  produtosCatalogoExpandido.push(produtoCatalogo("extra-hortela", "Hortelã", "Extras para drinks", ["Maço"]));
  produtosCatalogoExpandido.push(produtoCatalogo("extra-xarope-grenadine", "Xarope de grenadine", "Extras para drinks", ["Unidade"], { permiteMistura: false }));

  [
    ["agua-sem-gas", "Água mineral sem gás", "Garrafa pequena"],
    ["agua-com-gas", "Água mineral com gás", "Garrafa pequena"],
    ["agua-coco", "Água de coco", "Unidade"],
    ["suco-del-valle", "Suco Del Valle", "Caixinha"],
    ["suco-maguary", "Suco Maguary", "Garrafa"],
    ["gatorade", "Gatorade", "Garrafa"],
    ["powerade", "Powerade", "Garrafa"],
    ["cha-matte-leao", "Chá gelado Matte Leão", "Garrafa"]
  ].forEach(([id, nome, variacao]) => produtosCatalogoExpandido.push(
    produtoCatalogo(id, nome, "Água, sucos e chás", [variacao])
  ));

  [
    ["refrigerante-pepsi", "Pepsi"],
    ["refrigerante-kuat", "Kuat"],
    ["refrigerante-guarana-antarctica", "Guaraná Antarctica"],
    ["refrigerante-fanta-uva", "Fanta Uva"],
    ["refrigerante-dolly", "Dolly"],
    ["refrigerante-schweppes", "Schweppes"],
    ["refrigerante-soda-limonada", "Soda limonada"]
  ].forEach(([id, nome]) => produtosCatalogoExpandido.push(
    produtoCatalogo(id, nome, "Refrigerantes", ["Lata", "Garrafa", "600 ml", "2 L"])
  ));

  [
    ["gelo-cubos", "Gelo em cubos"],
    ["gelo-barra", "Gelo em barra"],
    ["gelo-escama", "Gelo em escama"],
    ["gelo-filtrado", "Gelo filtrado"]
  ].forEach(([id, nome]) => produtosCatalogoExpandido.push(
    produtoCatalogo(id, nome, "Gelos", ["Pacote 2 kg", "Pacote 5 kg", "Pacote 10 kg"])
  ));

  ["Açaí", "Cupuaçu", "Casadinho"].forEach((nome) => {
    produtosCatalogoExpandido.push(produtoCatalogo(
      `acai-${nome.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}`,
      nome,
      "Açaí",
      ["200 ml", "300 ml", "400 ml", "500 ml", "700 ml", "770 ml", "1 litro"]
    ));
  });
  [
    ["complemento-leite-po", "Leite em pó"], ["complemento-leite-condensado", "Leite condensado"],
    ["complemento-leite-ninho", "Leite Ninho"], ["complemento-nutella", "Nutella"],
    ["complemento-pacoca", "Paçoca"], ["complemento-banana", "Banana"],
    ["complemento-morango", "Morango"], ["complemento-granola", "Granola"],
    ["complemento-amendoim", "Amendoim"], ["complemento-confete", "Confete"],
    ["complemento-coco", "Coco ralado"], ["complemento-gotas-chocolate", "Gotas de chocolate"]
  ].forEach(([id, nome]) => produtosCatalogoExpandido.push(
    produtoCatalogo(id, nome, "Complementos de açaí", ["Porção"])
  ));
  ["Chocolate", "Morango", "Leite condensado"].forEach((nome) => produtosCatalogoExpandido.push(
    produtoCatalogo(`calda-${nome.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}`, nome, "Caldas de açaí", ["Porção"])
  ));

  ["Eight", "Derby", "Free", "Rothmans", "L&M"].forEach((nome) => produtosCatalogoExpandido.push(
    produtoCatalogo(`cigarro-${nome.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}`, nome, "Cigarros", ["Picado", "Maço"], {
      restritoMaiores: true,
      avisoRestrito: "O consumo de cigarro é prejudicial à saúde"
    })
  ));
  [
    ["sedas-seda-ocb", "Seda OCB", false],
    ["sedas-seda-smoking", "Seda Smoking", false],
    ["sedas-filtro", "Filtro", false],
    ["sedas-piteira", "Piteira", false],
    ["sedas-fumo-rolo", "Fumo de rolo", true],
    ["acessorio-isqueiro", "Isqueiro", false],
    ["acessorio-fosforo", "Fósforo", false]
  ].forEach(([id, nome, restrito]) => produtosCatalogoExpandido.push(
    produtoCatalogo(id, nome, "Acessórios e tabacaria", ["Unidade", "Pacote"], {
      restritoMaiores: restrito,
      ...(restrito ? { avisoRestrito: "O consumo de cigarro é prejudicial à saúde" } : {})
    })
  ));

  [
    ["Balas e chicletes", ["Trident", "Halls", "Mentos", "Bubbaloo", "Fini"]],
    ["Chocolates", ["Lacta", "Garoto", "Nestlé", "Bis", "Trento"]],
    ["Biscoitos", ["Oreo", "Passatempo", "Club Social"]],
    ["Salgadinhos", ["Pringles", "Lay's", "Torcida", "Elma Chips"]],
    ["Petiscos", ["Castanhas", "Pipoca", "Azeitona", "Pé de moleque", "Paçoca"]]
  ].forEach(([categoria, nomes]) => nomes.forEach((nome) => produtosCatalogoExpandido.push(
    produtoCatalogo(
      `${categoria.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}-${nome.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}`,
      nome,
      categoria,
      ["Unidade", "Pacote pequeno", "Pacote grande"]
    )
  )));

  [
    "Copo descartável", "Prato descartável", "Talheres descartáveis", "Canudo", "Guardanapo",
    "Carvão", "Isqueiro grande", "Isqueiro pequeno", "Sal grosso", "Espeto", "Caixa térmica", "Isopor", "Balão", "Vela de aniversário"
  ].forEach((nome) => produtosCatalogoExpandido.push(
    produtoCatalogo(
      `festa-${nome.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}`,
      nome,
      "Festa e churrasco",
      ["Unidade", "Pacote"]
    )
  ));



  function criarPedidosExemplo() {
    const agora = Date.now();
    const exemplos = [
      { sufixo: "001", dias: 0, status: "Recebido", produtoId: "demo-bebida", quantidade: 1 },
      { sufixo: "002", dias: 1, status: "Em preparo", produtoId: "demo-gelo", quantidade: 2 },
      { sufixo: "003", dias: 3, status: "Entregue", produtoId: "demo-acai", quantidade: 1 }
    ];

    return exemplos.map((exemplo) => {
      const data = new Date(agora - exemplo.dias * 24 * 60 * 60 * 1000).toISOString();
      const produto = produtosExemplo.find((item) => item.id === exemplo.produtoId);
      const variante = produto.variantes[0];
      return {
        id: `EXEMPLO-${exemplo.sufixo}`,
        clienteId: "cliente-exemplo",
        cliente: "Cliente de exemplo",
        telefone: "[TELEFONE A CONFIRMAR]",
        itens: [{
          produtoId: produto.id,
          varianteId: variante.id,
          nome: produto.nome,
          variante: variante.nome,
          quantidade: exemplo.quantidade,
          precoUnitario: null
        }],
        total: null,
        observacoes: "Pedido fictício para demonstração.",
        tipoEntrega: "Retirada na loja",
        endereco: "",
        pagamento: "Pix",
        status: exemplo.status,
        criadoEm: data,
        exemplo: true
      };
    });
  }

  function lerLista(chave, nome) {
    const conteudo = localStorage.getItem(chave);
    if (conteudo === null) return [];

    let dados;
    try {
      dados = JSON.parse(conteudo);
    } catch (error) {
      throw new Error(`Os dados de ${nome} estão inválidos no armazenamento local.`);
    }

    if (!Array.isArray(dados)) {
      throw new Error(`Os dados de ${nome} não estão no formato esperado.`);
    }
    return dados;
  }

  function salvarLista(chave, dados) {
    localStorage.setItem(chave, JSON.stringify(dados));
  }

  // Reverte as gravações caso alguma parte de uma operação composta falhe.
  function salvarTransacao(alteracoes) {
    const valoresAntigos = {};
    Object.keys(alteracoes).forEach((chave) => {
      valoresAntigos[chave] = localStorage.getItem(chave);
    });

    const gravadas = [];
    try {
      Object.entries(alteracoes).forEach(([chave, dados]) => {
        salvarLista(chave, dados);
        gravadas.push(chave);
      });
    } catch (erro) {
      try {
        gravadas.reverse().forEach((chave) => {
          const anterior = valoresAntigos[chave];
          if (anterior === null) localStorage.removeItem(chave);
          else localStorage.setItem(chave, anterior);
        });
      } catch (erroReversao) {
        throw new Error("Falha ao salvar os dados e ao restaurar o estado anterior. Libere espaço no navegador e tente novamente.");
      }
      throw new Error(`Não foi possível salvar os dados no navegador: ${erro.message}`);
    }
  }

  function gerarId(prefixo) {
    const aleatorio = Math.random().toString(36).slice(2, 8);
    return `${prefixo}-${Date.now().toString(36)}-${aleatorio}`;
  }

  function prepararDadosExemplo() {
    if (localStorage.getItem(CHAVES.produtos) === null) {
      salvarLista(CHAVES.produtos, [...produtosExemplo, ...produtosCatalogoInicial]);
    } else if (localStorage.getItem(CHAVE_CATALOGO_VARIANTES) !== "1") {
      const produtos = buscarProdutos();
      const existentes = new Set(produtos.map((produto) => produto.id));
      const faltantes = produtosCatalogoInicial.filter((produto) => !existentes.has(produto.id));
      if (faltantes.length) salvarLista(CHAVES.produtos, [...produtos, ...faltantes]);
    }
    localStorage.setItem(CHAVE_CATALOGO_VARIANTES, "1");
    prepararCatalogoCopao();
    if (localStorage.getItem(CHAVES.pedidos) === null) {
      salvarLista(CHAVES.pedidos, criarPedidosExemplo());
    }
    migrarCatalogoExpandido();
  }

  function migrarCatalogoExpandido() {
    const produtos = lerProdutos();
    const existentes = new Map(produtos.map((produto) => [produto.id, produto]));
    let alterado = false;
    const catalogoJaMigrado = localStorage.getItem(CHAVE_CATALOGO_EXPANDIDO) === "3";

    if (!catalogoJaMigrado) {
      const acendedorAnterior = existentes.get("festa-acendedor");
      if (acendedorAnterior && acendedorAnterior.nome !== "Isqueiro grande") {
        acendedorAnterior.nome = "Isqueiro grande";
        alterado = true;
      }

      const copaoExistentes = new Set([
        "gin-eternity", "gin-rocks", "white-horse", "jack-daniels", "red-label",
        "busca-brisa", "campari", "vodka"
      ]);
      copaoExistentes.forEach((id) => {
        const produto = existentes.get(id);
        if (!produto) return;
        if (produto.permiteCopao === undefined) {
          produto.permiteCopao = true;
          alterado = true;
        }
        if (produto.tipoBebida === undefined || produto.tipoBebida === "") {
          const tipo = bebidasComDose.find((item) => item.id === id);
          if (tipo) {
            produto.tipoBebida = tipo.tipoBebida;
            alterado = true;
          }
        }
      });
    }

    produtos.forEach((produto) => {
      const categoria = String(produto.categoria || "").toLocaleLowerCase("pt-BR");
      const categoriasSemCopao = [
        "balas", "balas e chicletes", "chocolates", "biscoitos", "salgadinhos",
        "petiscos", "doces e petiscos", "festa e churrasco", "açaí",
        "complementos de açaí", "caldas de açaí", "acessórios e tabacaria",
        "extras para drinks"
      ];
      if (categoriasSemCopao.includes(categoria) && produto.permiteCopao) {
        produto.permiteCopao = false;
        produto.tipoBebida = "";
        alterado = true;
      }
      const ehDestilado = produto.permiteCopao === true || ["whisky", "gin", "vodka", "rum", "cachaça", "aperitivo"].includes(produto.tipoBebida);
      produto.variantes = (produto.variantes || []).map((variante) => {
        const nome = String(variante.nome || "");
        if (nome.toLocaleLowerCase("pt-BR").startsWith("dose")) {
          return { ...variante, descricao: `Dose em copo de ${obterMedidasLoja().dose.tamanhoCopoMl} ml` };
        }
        if (nome.toLocaleLowerCase("pt-BR") === "copão") {
          return { ...variante, descricao: `Copão de ${obterMedidasLoja().copao.tamanhoCopoMl} ml, energético e gelo saborizado incluídos` };
        }
        return variante;
      });
      if ((ehDestilado || categoria === "cigarros" || categoria.includes("palha") || categoria.includes("tabacaria")) && produto.restritoMaiores !== true) {
        produto.restritoMaiores = true;
        alterado = true;
      }
      if (produto.restritoMaiores === undefined) {
        produto.restritoMaiores = false;
        alterado = true;
      }
      if (produto.permiteMistura === undefined) {
        produto.permiteMistura = false;
      }
    });

    if (!catalogoJaMigrado) {
      const preservarAcendedorComoGrande = existentes.has("festa-acendedor");
      const novos = produtosCatalogoExpandido.filter((produto) =>
        !existentes.has(produto.id)
        && !(preservarAcendedorComoGrande && produto.id === "festa-isqueiro-grande")
      );
      if (novos.length) {
        produtos.push(...novos);
        alterado = true;
      }
    }
    if (alterado) salvarProdutos(produtos);
    localStorage.setItem(CHAVE_CATALOGO_EXPANDIDO, "3");
  }

  function prepararCatalogoCopao() {
    if (localStorage.getItem(CHAVE_CATALOGO_COPAO) === "1") return;
    const produtos = buscarProdutos();
    let alterado = false;
    const produtosAtualizados = produtos.map((produto) => {
      const bebidaInicial = bebidasComDose.find((bebida) => bebida.id === produto.id);
      if (!bebidaInicial) return produto;
      const adicionarMarcadorVodka = produto.id === "vodka" && produto.nome === "Vodka";
      if (produto.permiteCopao === true && produto.tipoBebida && !adicionarMarcadorVodka) return produto;
      alterado = true;
      return {
        ...produto,
        ...(adicionarMarcadorVodka
          ? { nome: bebidaInicial.nome }
          : {}),
        permiteCopao: true,
        tipoBebida: produto.tipoBebida || bebidaInicial.tipoBebida
      };
    });

    if (!produtosAtualizados.some((produto) => produto.id === produtoGeloCopaoInicial.id)) {
      produtosAtualizados.push(produtoGeloCopaoInicial);
      alterado = true;
    }
    if (alterado) salvarProdutos(produtosAtualizados);
    localStorage.setItem(CHAVE_CATALOGO_COPAO, "1");
  }

  function restaurarDadosExemplo() {
    const produtos = buscarProdutos().filter((produto) => !produto.exemplo && !produtoDeExemplo(produto));
    const pedidos = buscarPedidos().filter((pedido) => !pedido.exemplo);
    salvarTransacao({
      [CHAVES.produtos]: [...produtos, ...produtosExemplo],
      [CHAVES.pedidos]: [...pedidos, ...criarPedidosExemplo()]
    });
  }

  function preencherEstoqueDemonstracao() {
    const ids = [];
    const produtos = buscarProdutos().map((produto) => {
      if (produto.catalogoInicial === false) {
        ids.push(produto.id);
        return {
          ...produto,
          demonstracaoEstoque: true,
          variantes: produto.variantes.map((variante) => ({ ...variante, estoque: 10 }))
        };
      }
      return produto;
    });
    salvarProdutos(produtos);
    localStorage.setItem(CHAVE_ESTOQUE_DEMO, JSON.stringify(ids));
    return ids.length;
  }

  function restaurarEstoqueDemonstracao() {
    const ids = lerListaOpcional(CHAVE_ESTOQUE_DEMO);
    if (!Array.isArray(ids)) return 0;
    const produtos = buscarProdutos().map((produto) => {
      if (!ids.includes(produto.id)) return produto;
      return {
        ...produto,
        demonstracaoEstoque: false,
        variantes: produto.variantes.map((variante) => ({ ...variante, estoque: 0 }))
      };
    });
    salvarProdutos(produtos);
    localStorage.removeItem(CHAVE_ESTOQUE_DEMO);
    return ids.length;
  }

  function reporProdutosEmFalta() {
    const categoriasBebidas = new Set([
      "Bebidas",
      "Cervejas",
      "Destilados",
      "Vinhos e espumantes",
      "Bebidas prontas",
      "Energéticos e misturas",
      "Água, sucos e chás",
      "Refrigerantes"
    ]);
    let unidadesAdicionadas = 0;
    let produtosAlterados = 0;
    const produtos = buscarProdutos().map((produto) => {
      if (produto.ativo === false) return produto;
      const quantidade = categoriasBebidas.has(produto.categoria) ? 25 : 10;
      let alterouProduto = false;
      const possuiGarrafa = produto.variantes.some((variante) =>
        variante.nome.toLocaleLowerCase("pt-BR") === "garrafa"
      );
      const variantes = produto.variantes.map((variante) => {
        if (variante.ativo === false) return variante;
        if (possuiGarrafa && variante.nome.toLocaleLowerCase("pt-BR").startsWith("dose")) {
          return variante;
        }
        if (variante.estoque > variante.minimo) return variante;
        alterouProduto = true;
        unidadesAdicionadas += quantidade;
        return { ...variante, estoque: variante.estoque + quantidade };
      });
      if (alterouProduto) produtosAlterados += 1;
      return { ...produto, variantes };
    });
    salvarProdutos(produtos);
    return { unidadesAdicionadas, produtosAlterados };
  }

  function produtoDeExemplo(produto) {
    return String(produto.id).startsWith("demo-");
  }

  function buscarUsuarios() {
    return lerLista(CHAVES.usuarios, "clientes");
  }

  function buscarUsuarioPorId(id) {
    return buscarUsuarios().find((usuario) => usuario.id === id) || null;
  }

  function normalizarNomeUsuario(valor, obrigatorio = true) {
    const nomeUsuario = String(valor || "").trim().toLowerCase();
    if (!nomeUsuario && !obrigatorio) return "";
    if (!/^[a-z0-9._-]{3,24}$/.test(nomeUsuario)) {
      throw new Error("O nome de usuário deve ter de 3 a 24 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.");
    }
    return nomeUsuario;
  }

  function salvarUsuario(usuario) {
    const usuarios = buscarUsuarios();
    const cpf = String(usuario.cpf || "").replace(/\D/g, "");
    const email = String(usuario.email || "").trim().toLowerCase();
    const nomeUsuario = normalizarNomeUsuario(usuario.nomeUsuario);
    if (usuarios.some((item) => item.cpf === cpf)) {
      throw new Error("Este CPF já está cadastrado.");
    }
    if (usuarios.some((item) => String(item.email || "").toLowerCase() === email)) {
      throw new Error("Este e-mail já está cadastrado.");
    }
    if (usuarios.some((item) => String(item.nomeUsuario || "").toLowerCase() === nomeUsuario)) {
      throw new Error("Este nome de usuário já está em uso.");
    }

    const novoUsuario = {
      id: gerarId("cliente"),
      nome: usuario.nome.trim(),
      nomeUsuario,
      nomeExibicao: "",
      cpf,
      telefone: String(usuario.telefone || "").replace(/\D/g, ""),
      email,
      dataNascimento: usuario.dataNascimento || "",
      senhaHash: usuario.senhaHash,
      foto: "",
      endereco: "",
      criadoEm: new Date().toISOString()
    };
    salvarLista(CHAVES.usuarios, [...usuarios, novoUsuario]);
    return novoUsuario;
  }

  function atualizarUsuario(id, alteracoes) {
    const usuarios = buscarUsuarios();
    const indice = usuarios.findIndex((usuario) => usuario.id === id);
    if (indice < 0) throw new Error("Não encontramos este cadastro.");

    const cpf = String(alteracoes.cpf || usuarios[indice].cpf).replace(/\D/g, "");
    const email = String(alteracoes.email || usuarios[indice].email).trim().toLowerCase();
    const nomeUsuario = alteracoes.nomeUsuario === undefined
      ? String(usuarios[indice].nomeUsuario || "")
      : normalizarNomeUsuario(alteracoes.nomeUsuario, Boolean(usuarios[indice].nomeUsuario));
    if (usuarios.some((item) => item.id !== id && item.cpf === cpf)) {
      throw new Error("Este CPF já está em uso por outra conta.");
    }
    if (usuarios.some((item) => item.id !== id && String(item.email || "").toLowerCase() === email)) {
      throw new Error("Este e-mail já está em uso por outra conta.");
    }
    if (nomeUsuario && usuarios.some((item) => {
      return item.id !== id && String(item.nomeUsuario || "").toLowerCase() === nomeUsuario;
    })) {
      throw new Error("Este nome de usuário já está em uso.");
    }

    usuarios[indice] = {
      ...usuarios[indice],
      ...alteracoes,
      cpf,
      email,
      nomeUsuario,
      telefone: String(alteracoes.telefone || "").replace(/\D/g, "")
    };
    salvarLista(CHAVES.usuarios, usuarios);
    return usuarios[indice];
  }

  function buscarUsuarioPorCredencial(credencial) {
    const valor = credencial.trim();
    const digitos = valor.replace(/\D/g, "");
    const nomeUsuario = valor.toLowerCase();
    return buscarUsuarios().find((usuario) => {
      return String(usuario.email || "").toLowerCase() === nomeUsuario
        || usuario.cpf === digitos
        || String(usuario.nomeUsuario || "").toLowerCase() === nomeUsuario;
    }) || null;
  }

  function iniciarSessaoCliente(usuarioId) {
    localStorage.setItem(CHAVES.sessaoCliente, JSON.stringify({ usuarioId }));
  }

  function buscarClienteAtual() {
    const conteudo = localStorage.getItem(CHAVES.sessaoCliente);
    if (!conteudo) return null;
    let sessao;
    try {
      sessao = JSON.parse(conteudo);
    } catch (error) {
      throw new Error("A sessão do cliente está inválida. Entre novamente.");
    }
    const usuario = buscarUsuarioPorId(sessao.usuarioId);
    if (!usuario) {
      localStorage.removeItem(CHAVES.sessaoCliente);
      return null;
    }
    return usuario;
  }

  function encerrarSessaoCliente() {
    localStorage.removeItem(CHAVES.sessaoCliente);
  }

  function normalizarVariante(variante, produtoId, indice) {
    const nome = String(variante.nome || "").trim();
    const preco = variante.preco === "" || variante.preco === null || variante.preco === undefined
      ? null
      : Number(variante.preco);
    if (variante.estoque === "" || variante.minimo === "") {
      throw new Error(`Informe o estoque e o mínimo para a opção ${nome || indice + 1}.`);
    }
    const estoque = variante.estoque === undefined ? 0 : Number(variante.estoque);
    const minimo = variante.minimo === undefined ? 0 : Number(variante.minimo);
    if (!nome) throw new Error("Cada opção de venda precisa ter um nome.");
    if (preco !== null && (!Number.isFinite(preco) || preco < 0)) {
      throw new Error(`Informe um preço válido para a opção ${nome} ou deixe-o em branco.`);
    }
    if (!Number.isInteger(estoque) || estoque < 0 || !Number.isInteger(minimo) || minimo < 0) {
      throw new Error(`Estoque e mínimo da opção ${nome} precisam ser números inteiros não negativos.`);
    }
    const nomeNormalizado = nome.toLocaleLowerCase("pt-BR");
    return {
      ...variante,
      id: variante.id || `${produtoId}-opcao-${indice + 1}`,
      nome,
      preco,
      estoque,
      minimo,
      ativo: variante.ativo !== false,
      ...(nomeNormalizado === "garrafa" ? { dosesVendidas: Number.isInteger(variante.dosesVendidas) ? Math.max(0, Math.min(DOSES_POR_GARRAFA, variante.dosesVendidas)) : 0 } : {})
    };
  }

  function sincronizarCamposLegados(produto) {
    const atualizado = { ...produto, variantes: produto.variantes };
    if (atualizado.variantes.length === 1) {
      const variante = atualizado.variantes[0];
      atualizado.preco = variante.preco;
      atualizado.estoque = variante.estoque;
      atualizado.minimo = variante.minimo;
    } else {
      delete atualizado.preco;
      delete atualizado.estoque;
      delete atualizado.minimo;
    }
    return atualizado;
  }

  function normalizarProduto(produto) {
    if (!produto || !produto.id || !String(produto.nome || "").trim()) {
      throw new Error("Há um produto sem identificação ou nome válido no armazenamento local.");
    }
    const variantesLegadas = Array.isArray(produto.variantes)
      ? produto.variantes
      : [{
        id: `${produto.id}-padrao`,
        nome: produto.apresentacao || "Padrão",
        preco: produto.preco,
        estoque: produto.estoque,
        minimo: produto.minimo
      }];
    if (!variantesLegadas.length) {
      throw new Error(`O produto ${produto.nome} precisa ter pelo menos uma opção de venda.`);
    }
    const variantes = variantesLegadas.map((variante, indice) => normalizarVariante(variante, produto.id, indice));
    const ids = new Set();
    variantes.forEach((variante) => {
      if (ids.has(variante.id)) throw new Error(`O produto ${produto.nome} tem opções com identificadores repetidos.`);
      ids.add(variante.id);
    });
    return sincronizarCamposLegados({
      ...produto,
      nome: String(produto.nome).trim(),
      ativo: produto.ativo !== false,
      variantes
    });
  }

  function migrarPedidosSemVariante(produtos) {
    const pedidos = lerLista(CHAVES.pedidos, "pedidos");
    let houveMigracao = false;
    const produtosPorId = new Map(produtos.map((produto) => [produto.id, produto]));
    const atualizados = pedidos.map((pedido) => {
      if (!Array.isArray(pedido.itens)) return pedido;
      let pedidoAlterado = false;
      const itens = pedido.itens.map((item) => {
        if (item.varianteId) return item;
        const produto = produtosPorId.get(item.produtoId);
        if (!produto || produto.variantes.length !== 1) return item;
        houveMigracao = true;
        pedidoAlterado = true;
        return {
          ...item,
          varianteId: produto.variantes[0].id,
          variante: item.variante || produto.variantes[0].nome
        };
      });
      return pedidoAlterado ? { ...pedido, itens } : pedido;
    });
    if (houveMigracao) salvarLista(CHAVES.pedidos, atualizados);
  }

  function buscarProdutos() {
    const dados = lerLista(CHAVES.produtos, "produtos");
    const produtos = dados.map(normalizarProduto);
    produtos.forEach((produto) => {
      const garrafa = produto.variantes.find((variante) => {
        return variante.nome.toLocaleLowerCase("pt-BR") === "garrafa";
      });
      const dose = produto.variantes.find((variante) => {
        return variante.nome.toLocaleLowerCase("pt-BR").startsWith("dose");
      });
      if (garrafa && dose) {
        const dosesVendidas = Number.isInteger(garrafa.dosesVendidas)
          ? Math.max(0, Math.min(DOSES_POR_GARRAFA, garrafa.dosesVendidas))
          : 0;
        garrafa.dosesVendidas = dosesVendidas;
        dose.estoque = Math.max(0, garrafa.estoque * DOSES_POR_GARRAFA - dosesVendidas);
      }
    });
    if (JSON.stringify(dados) !== JSON.stringify(produtos)) salvarLista(CHAVES.produtos, produtos);
    migrarPedidosSemVariante(produtos);
    return produtos;
  }

  function salvarProdutos(produtos) {
    salvarLista(CHAVES.produtos, produtos.map(normalizarProduto));
  }

  function salvarProduto(produto) {
    const produtos = buscarProdutos();
    const id = produto.id || gerarId("produto");
    const indice = produtos.findIndex((item) => item.id === id);
    const existente = indice < 0 ? null : produtos[indice];
    const variantes = (produto.variantes || []).map((variante, indiceVariante) => normalizarVariante(variante, id, indiceVariante));
    if (!variantes.length) throw new Error("Adicione pelo menos uma opção de venda.");
    const garrafa = variantes.find((variante) => variante.nome.toLocaleLowerCase("pt-BR") === "garrafa");
    const dose = variantes.find((variante) => variante.nome.toLocaleLowerCase("pt-BR").startsWith("dose"));
    if (garrafa && dose) {
      dose.estoque = garrafa.estoque * DOSES_POR_GARRAFA;
      dose.minimo = 0;
    }
    const ids = new Set();
    variantes.forEach((variante) => {
      if (ids.has(variante.id)) throw new Error("Cada opção de venda precisa ter um identificador único.");
      ids.add(variante.id);
    });

    if (existente) {
      const removidas = new Set(existente.variantes.filter((variante) => !ids.has(variante.id)).map((variante) => variante.id));
      const usadaEmPedido = buscarPedidos().some((pedido) => pedido.itens.some((item) => {
        return (item.produtoId === id && (!item.varianteId || removidas.has(item.varianteId)))
          || (item.geloProdutoId === id && (!item.geloVarianteId || removidas.has(item.geloVarianteId)));
      }));
      if (removidas.size && usadaEmPedido) {
        throw new Error("Uma opção usada em pedidos não pode ser removida. Desative-a para preservar o histórico.");
      }
    }

    const categoria = String(produto.categoria || "").toLocaleLowerCase("pt-BR");
    const categoriasSemCopao = [
      "balas", "balas e chicletes", "chocolates", "biscoitos", "salgadinhos",
      "petiscos", "doces e petiscos", "festa e churrasco", "açaí",
      "complementos de açaí", "caldas de açaí", "acessórios e tabacaria",
      "extras para drinks"
    ];
    const permiteCopao = categoriasSemCopao.includes(categoria)
      ? false
      : produto.permiteCopao === undefined
      ? Boolean(existente && existente.permiteCopao)
      : produto.permiteCopao === true;
    const tipoBebida = String(produto.tipoBebida || (existente && existente.tipoBebida) || "").trim();
    const tiposBebidaValidos = ["whisky", "gin", "vodka", "rum", "cachaça", "aperitivo", "outro"];
    if (permiteCopao && !tiposBebidaValidos.includes(tipoBebida)) {
      throw new Error("Escolha o tipo de bebida para habilitar a montagem de copão.");
    }

    const novo = sincronizarCamposLegados({
      ...(existente || {}),
      id,
      nome: String(produto.nome || "").trim(),
      categoria: produto.categoria,
      ativo: produto.ativo === undefined ? !existente || existente.ativo !== false : produto.ativo !== false,
      permiteCopao,
      tipoBebida: permiteCopao ? tipoBebida : "",
      permiteMistura: produto.permiteMistura === true,
      restritoMaiores: produto.restritoMaiores === true,
      avisoRestrito: produto.avisoRestrito || "",
      variantes,
      exemplo: false
    });
    if (!novo.nome) throw new Error("Informe o nome do produto.");
    if (indice < 0) produtos.push(novo);
    else produtos[indice] = novo;
    salvarProdutos(produtos);
    return novo;
  }

  function atualizarEstoqueVariante(produtoId, varianteId, estoque) {
    const quantidade = Number(estoque);
    if (!Number.isInteger(quantidade) || quantidade < 0) {
      throw new Error("O estoque precisa ser um número inteiro não negativo.");
    }

    const produtos = buscarProdutos();
    const produto = produtos.find((item) => item.id === produtoId);
    if (!produto) throw new Error("O produto não foi encontrado.");
    const variante = produto.variantes.find((item) => item.id === varianteId);
    if (!variante) throw new Error("A opção de venda não foi encontrada.");
    variante.estoque = quantidade;

    const garrafa = produto.variantes.find((item) => item.nome.toLocaleLowerCase("pt-BR") === "garrafa");
    const dose = produto.variantes.find((item) => item.nome.toLocaleLowerCase("pt-BR").startsWith("dose"));
    if (garrafa && dose) {
      dose.estoque = Math.max(0, garrafa.estoque * DOSES_POR_GARRAFA - garrafa.dosesVendidas);
    }

    salvarProdutos(produtos);
    return produto;
  }

  function localizarVariante(produto, varianteId) {
    if (varianteId) return produto.variantes.find((variante) => variante.id === varianteId) || null;
    return produto.variantes.length === 1 ? produto.variantes[0] : null;
  }

  function alterarEstoqueVariantes(produtos, itens, diferenca) {
    const atualizados = produtos.map((produto) => ({
      ...produto,
      variantes: produto.variantes.map((variante) => ({ ...variante }))
    }));
    const quantidades = new Map();
    itens.forEach((item) => {
      const chave = JSON.stringify([item.produtoId, item.varianteId || ""]);
      quantidades.set(chave, (quantidades.get(chave) || 0) + Number(item.quantidade));
    });
    quantidades.forEach((quantidade, chave) => {
      const [produtoId, varianteId] = JSON.parse(chave);
      const produto = atualizados.find((registro) => registro.id === produtoId);
      const variante = produto && localizarVariante(produto, varianteId);
      if (!produto || !variante) {
        throw new Error("Não foi possível identificar a opção de um pedido para atualizar o estoque.");
      }
      if (!Number.isInteger(quantidade) || quantidade < 1) {
        throw new Error("A quantidade de uma opção no pedido é inválida.");
      }
      const novoEstoque = variante.estoque + diferenca * quantidade;
      if (novoEstoque < 0) throw new Error(`Estoque insuficiente para ${produto.nome} — ${variante.nome}.`);
      variante.estoque = novoEstoque;
    });
    return atualizados.map(sincronizarCamposLegados);
  }

  function alterarEstoquePedido(produtos, itens, diferenca) {
    // Doses vêm das garrafas: cada garrafa rende 10 doses.
    const itensSemDose = itens.filter((item) => {
      const produto = produtos.find((registro) => registro.id === item.produtoId);
      if (!produto) return true;
      const variante = localizarVariante(produto, item.varianteId);
      return !variante || !variante.nome.toLocaleLowerCase("pt-BR").startsWith("dose");
    });
    let estoqueBase = alterarEstoqueVariantes(produtos, itensSemDose, diferenca);
    const dosesPorProduto = new Map();
    itens.forEach((item) => {
      const produto = produtos.find((registro) => registro.id === item.produtoId);
      if (!produto) return;
      const variante = localizarVariante(produto, item.varianteId);
      if (!variante || !variante.nome.toLocaleLowerCase("pt-BR").startsWith("dose")) return;
      dosesPorProduto.set(produto.id, (dosesPorProduto.get(produto.id) || 0) + Number(item.quantidade));
    });
    if (dosesPorProduto.size) {
      estoqueBase = estoqueBase.map((produto) => {
        const quantidade = dosesPorProduto.get(produto.id);
        if (!quantidade) return produto;
        const garrafa = produto.variantes.find((variante) => variante.nome.toLocaleLowerCase("pt-BR") === "garrafa");
        if (!garrafa) throw new Error(`O produto ${produto.nome} não tem garrafa cadastrada para calcular as doses.`);
        for (let indice = 0; indice < quantidade; indice += 1) {
          if (diferenca < 0) {
            const dosesVendidas = Number.isInteger(garrafa.dosesVendidas) ? garrafa.dosesVendidas : 0;
            if (dosesVendidas >= DOSES_POR_GARRAFA - 1) {
              if (garrafa.estoque < 1) throw new Error(`Estoque insuficiente de garrafas para doses de ${produto.nome}.`);
              garrafa.estoque -= 1;
              garrafa.dosesVendidas = 0;
            } else {
              garrafa.dosesVendidas = dosesVendidas + 1;
            }
          } else {
            const dosesVendidas = Number.isInteger(garrafa.dosesVendidas) ? garrafa.dosesVendidas : 0;
            if (dosesVendidas > 0) {
              garrafa.dosesVendidas = dosesVendidas - 1;
            } else {
              garrafa.estoque += 1;
              garrafa.dosesVendidas = DOSES_POR_GARRAFA - 1;
            }
          }
        }
        const dose = produto.variantes.find((variante) => variante.nome.toLocaleLowerCase("pt-BR").startsWith("dose"));
        if (dose) dose.estoque = Math.max(0, garrafa.estoque * DOSES_POR_GARRAFA - garrafa.dosesVendidas);
        return produto;
      });
    }
    const itensDeGelo = itens
      .filter((item) => item.geloProdutoId && item.geloVarianteId)
      .map((item) => ({
        produtoId: item.geloProdutoId,
        varianteId: item.geloVarianteId,
        quantidade: item.quantidade
      }));
    return itensDeGelo.length
      ? alterarEstoqueVariantes(estoqueBase, itensDeGelo, diferenca)
      : estoqueBase;
  }

  function removerProduto(id) {
    const pedidos = buscarPedidos();
    const usado = pedidos.some((pedido) => pedido.itens.some((item) => {
      return item.produtoId === id || item.geloProdutoId === id;
    }));
    if (usado) throw new Error("Este produto aparece em pedidos. Desative-o em vez de removê-lo.");
    salvarProdutos(buscarProdutos().filter((produto) => produto.id !== id));
  }

  function buscarPedidos() {
    return lerLista(CHAVES.pedidos, "pedidos");
  }

  function buscarPedidosDoCliente(clienteId) {
    return buscarPedidos()
      .filter((pedido) => pedido.clienteId === clienteId)
      .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
  }

  function salvarPedido(pedidoRascunho) {
    if (!Array.isArray(pedidoRascunho.itens) || !pedidoRascunho.itens.length) {
      throw new Error("Adicione ao menos um produto ao pedido.");
    }
    const produtos = buscarProdutos();
    const itens = pedidoRascunho.itens.map((item) => {
      const produto = produtos.find((registro) => registro.id === item.produtoId && registro.ativo);
      const quantidade = Number(item.quantidade);
      if (!produto) throw new Error("Um produto do pedido não está mais disponível.");
      if (produto.somenteCopao) throw new Error("Escolha o sabor do gelo dentro da montagem de copão.");
      if (!Number.isInteger(quantidade) || quantidade < 1) throw new Error("Confira as quantidades do pedido.");
      const variante = localizarVariante(produto, item.varianteId);
      if (!variante || !variante.ativo) throw new Error(`Escolha uma opção disponível para ${produto.nome}.`);
      const possuiProdutoGelo = Boolean(item.geloProdutoId);
      const possuiVarianteGelo = Boolean(item.geloVarianteId);
      if (possuiProdutoGelo !== possuiVarianteGelo) {
        throw new Error("A montagem do copão precisa incluir uma opção válida de gelo.");
      }
      let gelo = null;
      if (possuiProdutoGelo) {
        const ehCopao = variante.nome.toLocaleLowerCase("pt-BR") === "copão";
        if (!produto.permiteCopao || !ehCopao) {
          throw new Error("Esta bebida não está habilitada para montagem de copão.");
        }
        const produtoGelo = produtos.find((registro) => {
          return registro.id === item.geloProdutoId && registro.ativo && registro.somenteCopao;
        });
        gelo = produtoGelo && localizarVariante(produtoGelo, item.geloVarianteId);
        if (!gelo || !gelo.ativo) throw new Error("O sabor de gelo escolhido não está mais disponível.");
        if (quantidade > gelo.estoque) throw new Error(`Estoque insuficiente para o gelo de ${gelo.nome}.`);
      } else if (produto.permiteCopao && variante.nome.toLocaleLowerCase("pt-BR") === "copão") {
        throw new Error("Escolha um sabor de gelo para montar o copão.");
      }
      if (quantidade > variante.estoque) throw new Error(`Estoque insuficiente para ${produto.nome} — ${variante.nome}.`);
      if (!Number.isFinite(variante.preco) || variante.preco < 0) {
        throw new Error(`O preço de ${produto.nome} — ${variante.nome} ainda precisa ser confirmado pelo gestor.`);
      }
      return {
        produtoId: produto.id,
        varianteId: variante.id,
        nome: produto.nome,
        variante: gelo ? `${variante.nome} · gelo ${gelo.nome}` : variante.nome,
        ...(gelo ? { geloProdutoId: item.geloProdutoId, geloVarianteId: gelo.id, saborGelo: gelo.nome } : {}),
        quantidade,
        precoUnitario: variante.preco
      };
    });

    const total = itens.reduce((soma, item) => soma + item.precoUnitario * item.quantidade, 0);
    const novoPedido = {
      ...pedidoRascunho,
      id: gerarId("MD"),
      itens,
      total,
      status: "Recebido",
      criadoEm: new Date().toISOString(),
      exemplo: false
    };
    const estoqueAtualizado = alterarEstoquePedido(produtos, itens, -1);
    salvarTransacao({
      [CHAVES.produtos]: estoqueAtualizado,
      [CHAVES.pedidos]: [...buscarPedidos(), novoPedido]
    });
    return novoPedido;
  }

  function atualizarStatusPedido(id, novoStatus) {
    if (!STATUS_PEDIDO.includes(novoStatus)) throw new Error("Status de pedido inválido.");
    const pedidos = buscarPedidos();
    const indice = pedidos.findIndex((pedido) => pedido.id === id);
    if (indice < 0) throw new Error("Não encontramos este pedido.");
    const pedido = pedidos[indice];
    if (pedido.status === "Entregue" || pedido.status === "Cancelado") {
      throw new Error("Este pedido já foi finalizado e não pode mudar de status.");
    }
    const transicoesPermitidas = {
      Recebido: ["Em preparo", "Cancelado"],
      "Em preparo": ["Pronto", "Cancelado"],
      Pronto: ["Entregue", "Cancelado"]
    };
    if (!transicoesPermitidas[pedido.status] || !transicoesPermitidas[pedido.status].includes(novoStatus)) {
      throw new Error("Este pedido só pode avançar para a próxima etapa ou ser cancelado.");
    }

    let estoque;
    if (novoStatus === "Cancelado" && pedido.status !== "Cancelado") {
      estoque = alterarEstoquePedido(buscarProdutos(), pedido.itens, 1);
    }
    pedidos[indice] = { ...pedido, status: novoStatus };
    salvarTransacao(novoStatus === "Cancelado"
      ? { [CHAVES.produtos]: estoque, [CHAVES.pedidos]: pedidos }
      : { [CHAVES.pedidos]: pedidos });
    return pedidos[indice];
  }

  function restaurarEstoquePedido(pedido) {
    const estoque = alterarEstoquePedido(buscarProdutos(), pedido.itens, 1);
    salvarProdutos(estoque);
  }

  function iniciarSessaoGestor() {
    localStorage.setItem(CHAVES.sessaoGestor, JSON.stringify({ ativa: true }));
  }

  function temSessaoGestor() {
    const conteudo = localStorage.getItem(CHAVES.sessaoGestor);
    if (!conteudo) return false;
    try {
      return JSON.parse(conteudo).ativa === true;
    } catch (error) {
      throw new Error("A sessão do gestor está inválida. Entre novamente.");
    }
  }

  function encerrarSessaoGestor() {
    localStorage.removeItem(CHAVES.sessaoGestor);
  }

  function mascararCpf(valor) {
    const digitos = String(valor || "").replace(/\D/g, "");
    if (digitos.length !== 11) return "***.***.***-**";
    return `***.***.***-${digitos.slice(-2)}`;
  }

  function formatarCpf(valor) {
    return String(valor || "")
      .replace(/\D/g, "")
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function criarLinkWhatsApp(mensagem) {
    return `https://wa.me/${CONFIGURACAO_LOJA.whatsapp}?text=${encodeURIComponent(mensagem)}`;
  }

  function obterConfiguracaoLoja() {
    return {
      ...CONFIGURACAO_LOJA,
      horarios: {
        ...CONFIGURACAO_LOJA.horarios,
        dias: { ...CONFIGURACAO_LOJA.horarios.dias }
      },
      instagram: { ...CONFIGURACAO_LOJA.instagram }
    };
  }

  function trocarTema(tema) {
    if (tema !== "light" && tema !== "dark") throw new Error("Tema desconhecido.");
    document.documentElement.dataset.theme = tema;
    localStorage.setItem(CHAVES.tema, tema);
  }

  function obterCategoriasProdutos() {
    return [...new Set(buscarProdutos()
      .map((produto) => String(produto.categoria || "").trim())
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function iniciarControlesDeTema() {
    document.querySelectorAll("[data-theme-toggle]").forEach((botao) => {
      const sincronizarBotao = () => {
        const escuro = document.documentElement.dataset.theme === "dark";
        botao.setAttribute("aria-label", escuro ? "Ativar tema claro" : "Ativar tema escuro");
        botao.setAttribute("aria-pressed", String(escuro));
        botao.textContent = escuro ? "☀" : "☾";
      };
      sincronizarBotao();
      botao.addEventListener("click", () => {
        const proximoTema = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        trocarTema(proximoTema);
        sincronizarBotao();
      });
    });
  }

  function criarElemento(tag, texto, classe) {
    const elemento = document.createElement(tag);
    if (texto) elemento.textContent = texto;
    if (classe) elemento.className = classe;
    return elemento;
  }

  function montarMenuCliente() {
    document.querySelectorAll("[data-customer-menu]").forEach((slot) => {
      slot.replaceChildren();
      let cliente;
      try {
        cliente = buscarClienteAtual();
      } catch (erro) {
        slot.append(criarElemento("span", "Sessão indisponível", "account-error"));
        slot.setAttribute("role", "status");
        return;
      }

      slot.classList.add("customer-menu");
      if (!cliente) {
        const linkEntrar = criarElemento("a", "Entrar", "button button-outline");
        linkEntrar.href = "auth.html";
        slot.append(linkEntrar);
      } else {
        const botaoConta = criarElemento("button", "", "account-trigger");
        botaoConta.type = "button";
        botaoConta.setAttribute("aria-expanded", "false");
        botaoConta.setAttribute("aria-haspopup", "true");

        const avatar = cliente.foto
          ? document.createElement("img")
          : criarElemento("span", cliente.nome.trim().charAt(0).toUpperCase(), "account-avatar");
        if (cliente.foto) {
          avatar.src = cliente.foto;
          avatar.alt = "";
          avatar.className = "account-avatar";
        }
        const nomeExibicao = (cliente.nomeExibicao || "").trim();
        const nomeConta = nomeExibicao || cliente.nome.split(/\s+/)[0];
        botaoConta.append(avatar, criarElemento("span", nomeConta, "account-display-name"));

        const menuConta = criarElemento("div", "", "account-dropdown");
        menuConta.hidden = true;
        const linkPerfil = criarElemento("a", "Meu perfil");
        linkPerfil.href = "perfil.html";
        const linkPedidos = criarElemento("a", "Meus pedidos");
        linkPedidos.href = "perfil.html#pedidos";
        const botaoSair = criarElemento("button", "Sair");
        botaoSair.type = "button";
        botaoSair.addEventListener("click", () => {
          encerrarSessaoCliente();
          window.location.href = "index.html";
        });
        menuConta.append(linkPerfil, linkPedidos, botaoSair);
        botaoConta.addEventListener("click", () => {
          const aberto = botaoConta.getAttribute("aria-expanded") === "true";
          botaoConta.setAttribute("aria-expanded", String(!aberto));
          menuConta.hidden = aberto;
        });
        slot.append(botaoConta, menuConta);
      }
    });
  }

  function iniciarLinksDePedido() {
    document.querySelectorAll(".order-link").forEach((link) => {
      link.addEventListener("click", (evento) => {
        let cliente;
        try {
          cliente = buscarClienteAtual();
        } catch (erro) {
          evento.preventDefault();
          window.alert(erro.message);
          return;
        }
        if (cliente) return;
        evento.preventDefault();
        window.location.href = "auth.html?retorno=pedido.html";
      });
    });
  }

  function inicializarComponentesCompartilhados() {
    montarMenuCliente();
    iniciarControlesDeTema();
    iniciarLinksDePedido();

    document.addEventListener("click", (evento) => {
      document.querySelectorAll(".account-dropdown:not([hidden])").forEach((menu) => {
        const raiz = menu.closest(".customer-menu");
        if (!raiz.contains(evento.target)) {
          menu.hidden = true;
          raiz.querySelector(".account-trigger").setAttribute("aria-expanded", "false");
        }
      });
    });
    document.addEventListener("keydown", (evento) => {
      if (evento.key !== "Escape") return;
      document.querySelectorAll(".account-dropdown:not([hidden])").forEach((menu) => {
        menu.hidden = true;
        menu.closest(".customer-menu").querySelector(".account-trigger").setAttribute("aria-expanded", "false");
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inicializarComponentesCompartilhados, { once: true });
  } else {
    inicializarComponentesCompartilhados();
  }

  window.MyDrinkStorage = {
    statusPedido: STATUS_PEDIDO,
    obterConfiguracaoLoja,
    obterStatusFuncionamento,
    definirHorarioEstendidoHoje,
    prepararDadosExemplo,
    restaurarDadosExemplo,
    preencherEstoqueDemonstracao,
    restaurarEstoqueDemonstracao,
    reporProdutosEmFalta,
    buscarUsuarios,
    buscarUsuarioPorId,
    normalizarNomeUsuario,
    buscarUsuarioPorCredencial,
    salvarUsuario,
    atualizarUsuario,
    iniciarSessaoCliente,
    buscarClienteAtual,
    encerrarSessaoCliente,
    atualizarMenuCliente: montarMenuCliente,
    buscarProdutos,
    obterCategoriasProdutos,
    obterMedidasLoja,
    salvarMedidasLoja,
    salvarProduto,
    atualizarEstoqueVariante,
    removerProduto,
    buscarPedidos,
    buscarPedidosDoCliente,
    salvarPedido,
    atualizarStatusPedido,
    restaurarEstoquePedido,
    iniciarSessaoGestor,
    temSessaoGestor,
    encerrarSessaoGestor,
    mascararCpf,
    formatarCpf,
    criarLinkWhatsApp,
    trocarTema,
    gerarId
  };
})();
