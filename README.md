<!-- Adicione aqui uma captura de tela: ![Prévia do site](images/preview.png) -->

# My Drink

Site demonstrativo da My Drink, com informações da loja e recursos para pedidos. 🥤

## Sobre o projeto

Projeto individual da atividade escolar **Betim Digital – Desenvolvimento de Site para o Comércio Local**, da turma INF007, feito por Jhonatan Pires Inácio. O site apresenta a loja My Drink, de bebidas, gelos e açaí com a proposta “Preço de Fábrica”, na Avenida JK, 134, Centro, Betim – MG.

A loja depende do movimento presencial na praça e ainda não tem um site. O projeto oferece uma apresentação online e uma simulação de cadastro, pedidos e administração da loja.

## Funcionalidades

### Área pública
- Página inicial com seções Sobre, Produtos, Galeria, Contato e Localização, incluindo mapa.
- Links de WhatsApp e Instagram, preenchidos pela configuração da loja.
- Selo de funcionamento e opção de horário estendido até 3h, quando configurados/ativados.
- Alternância entre tema claro e escuro.
- Prévia do catálogo sincronizada em tempo real quando o Firebase está configurado.

### Área do cliente
- Cadastro e login com nome de usuário, e-mail ou CPF.
- Perfil editável, com foto, dados de contato e histórico de pedidos.
- Montagem de pedido com opções de venda, entrega ou retirada e forma de pagamento.
- Montador de copão com bebida e sabor de gelo, respeitando o estoque.

### Área do gestor
- Resumo, consulta e atualização de status dos pedidos.
- Cadastro e edição de produtos, opções, preços e estoque compartilhados pelo Firestore; lista de produtos em falta ou abaixo do mínimo.
- Login Firebase do gestor, publicação inicial sem sobrescrever dados editados e backup/importação do catálogo em JSON.
- Vendas com gráficos, relação de clientes e exportação de vendas em CSV.
- Ativação do horário estendido até 3h.

## Tecnologias utilizadas

- HTML
- CSS
- JavaScript puro
- `localStorage` do navegador para clientes, pedidos e cache do catálogo
- Firebase compat via CDN e Firestore, opcional para compartilhar o catálogo

## Estrutura do projeto

```text
My Drink/
├── README.md            # Documentação do projeto
├── index.html           # Página inicial e seções públicas
├── style.css            # Estilos e temas claro/escuro
├── script.js            # Interações da página inicial
├── storage.js           # Acesso ao catálogo, cache local, clientes e pedidos
├── firebase-config.js   # Configuração pública do app Web Firebase
├── firestore.rules      # Regras de acesso ao catálogo
├── auth.html            # Telas de login e cadastro do cliente
├── auth.js              # Lógica de autenticação do cliente
├── perfil.html          # Perfil e histórico de pedidos
├── perfil.js            # Edição do perfil e histórico
├── pedido.html          # Catálogo e finalização do pedido
├── pedido.js            # Lógica de pedidos e montagem de copão
├── gestor-login.html    # Entrada demonstrativa do gestor
├── gestor.html          # Painel administrativo
├── gestor.js            # Lógica do painel do gestor
└── images/              # Pasta de imagens; atualmente sem arquivos
```

## Como executar

Abra `index.html` no navegador. Para uma experiência mais confiável, use a extensão **Live Server** do VS Code e abra o projeto com ela. Não é necessário instalar dependências, frameworks ou servidor de aplicação.

## Como testar

1. Antes de pedir, entre na área do gestor e edite um produto de exemplo para preencher um preço; os preços de demonstração começam sem confirmação.
2. Na página de cadastro, crie uma conta usando dados fictícios e este CPF sintético válido para demonstração: **968.428.346-60**. Escolha uma senha com pelo menos seis caracteres.
3. Faça um pedido com uma opção disponível e finalize. Ele será registrado no navegador e a página oferecerá o envio dos detalhes pelo WhatsApp configurado.
4. Entre novamente na área do gestor e abra **Pedidos** para localizar e acompanhar o pedido.

No modo local demonstrativo, use o usuário `gestor` e a senha `mydrink@2026`. Com Firebase configurado, entre com o e-mail e a senha da conta do gestor criada no Firebase Authentication.

## Onde editar os dados da loja

Em `storage.js`, edite a constante `CONFIGURACAO_LOJA` para ajustar endereço, horários, WhatsApp e Instagram. O horário de segunda a sábado está configurado como 9h às 20h; o domingo está sem horário definido. Substitua os marcadores de confirmação nos arquivos pelos dados confirmados. O WhatsApp na configuração usa o formato internacional apenas com dígitos. Os preços e estoques dos produtos podem ser preenchidos no painel do gestor.

## Catálogo compartilhado (Firebase)

O catálogo público usa o Firestore quando a configuração está preenchida. Clientes, senhas, CPFs, perfis e pedidos continuam no `localStorage` deste navegador; esses dados pessoais não são enviados ao Firebase. O estoque compartilhado só muda por ações do gestor, não pela criação de pedidos de clientes.

1. Crie um projeto no [console do Firebase](https://console.firebase.google.com/) no plano gratuito e adicione um app Web.
2. Crie o banco Firestore em **modo de produção** e escolha uma região próxima do Brasil. A região do Firestore não pode ser alterada depois de criar o banco.
3. Em **Authentication > Provedores**, ative **E-mail/senha** e crie a conta do gestor.
4. Copie os valores da configuração do app Web para `firebase-config.js`: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId` e `appId`. `measurementId` é opcional. Preencha também `managerEmail` com o e-mail exato da conta autorizada do gestor.
5. Em **Firestore > Regras**, cole o conteúdo de `firestore.rules`, substitua `[EMAIL_DO_GESTOR]` pelo mesmo e-mail e publique as regras. Só produtos e documentos de configuração ficam publicamente legíveis; escrita exige a conta de gestor autorizada.
6. Abra o site, entre como gestor com a conta Firebase e clique em **Publicar catálogo inicial**. Esse botão cria apenas produtos ausentes e preserva preços e estoques já existentes.
7. Em **Authentication > Configurações > Domínios autorizados**, adicione `jhowzin7.github.io`.
8. Teste: cadastre um produto no painel, abra o site em outro aparelho ou em uma aba anônima e confirme que ele aparece sem recarregar.

As coleções são `produtos` (um documento por produto) e `config` (documentos `gelos`, `medidas`, `horario` e `categorias`). O painel oferece exportação e importação de backup JSON; a importação mostra a prévia de criações e atualizações antes de gravar.

Se `firebase-config.js` estiver em branco, o site continua no modo local demonstrativo. O painel informa que essas alterações não são compartilhadas; o login fixo de demonstração só é usado nesse modo. O catálogo guarda a última cópia local e informa quando está usando-a sem conexão. Pedidos e contas de clientes não são compartilhados entre dispositivos; isso exigiria backend e segurança adequados para dados pessoais.

O plano gratuito tem cotas de leitura e gravação. Para uma loja pequena e a apresentação, monitore o uso no console; atualizações em tempo real geram leituras para cada cliente conectado.

## Observações importantes

> - O catálogo pode ser compartilhado pelo Firestore; cache, contas de clientes e pedidos continuam locais por navegador.
> - O modo Firebase protege as gravações do catálogo pelas regras do Firestore. A conta do gestor usa Firebase Authentication; o acesso fixo só existe no modo local demonstrativo.
> - A autenticação de clientes e a confirmação de idade são simulações locais e não verificam identidade ou maioridade de forma segura.
> - A venda de bebidas alcoólicas e cigarros é restrita a maiores de 18 anos.

## Próximos passos

Ideias para evoluções futuras: backend seguro para pedidos e contas de clientes, pagamento online, notificações de pedido, feed automático do Instagram e fotos reais da loja.

## Autor e créditos

Jhonatan Pires Inácio — turma INF007 — projeto Betim Digital.

## Licença

Projeto para fins educacionais.
