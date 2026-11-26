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

### Área do cliente
- Cadastro e login com nome de usuário, e-mail ou CPF.
- Perfil editável, com foto, dados de contato e histórico de pedidos.
- Montagem de pedido com opções de venda, entrega ou retirada e forma de pagamento.
- Montador de copão com bebida e sabor de gelo, respeitando o estoque.

### Área do gestor
- Resumo, consulta e atualização de status dos pedidos.
- Cadastro e edição de produtos, opções, preços e estoque; quantidades alteradas em opções já cadastradas são salvas ao confirmar o campo; lista de produtos em falta ou abaixo do mínimo.
- Vendas com gráficos, relação de clientes e exportação de vendas em CSV.
- Ativação do horário estendido até 3h.

## Tecnologias utilizadas

- HTML
- CSS
- JavaScript puro
- `localStorage` do navegador

## Estrutura do projeto

```text
My Drink/
├── README.md            # Documentação do projeto
├── index.html           # Página inicial e seções públicas
├── style.css            # Estilos e temas claro/escuro
├── script.js            # Interações da página inicial
├── storage.js           # Configuração da loja e dados locais
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

Credenciais do gestor para apresentação: usuário `gestor` e senha `mydrink@2026`.

## Onde editar os dados da loja

Em `storage.js`, edite a constante `CONFIGURACAO_LOJA` para ajustar endereço, horários, WhatsApp e Instagram. O horário de segunda a sábado está configurado como 9h às 20h; o domingo está sem horário definido. Substitua os marcadores de confirmação nos arquivos pelos dados confirmados. O WhatsApp na configuração usa o formato internacional apenas com dígitos. Os preços e estoques dos produtos podem ser preenchidos no painel do gestor.

## Observações importantes

> - Os dados ficam no `localStorage` do navegador. Cadastros, pedidos e estoque não são compartilhados entre aparelhos ou navegadores.
> - A autenticação é uma simulação didática. Um sistema real precisaria de servidor, banco de dados e proteção adequada para senhas e CPF.
> - As credenciais do gestor estão no código apenas para a demonstração.
> - A venda de bebidas alcoólicas e cigarros é restrita a maiores de 18 anos. **Este projeto não implementa verificação de maioridade.**

## Próximos passos

Ideias para evoluções futuras: servidor e banco de dados, pagamento online, notificações de pedido, feed automático do Instagram e fotos reais da loja.

## Autor e créditos

Jhonatan Pires Inácio — turma INF007 — projeto Betim Digital.

## Licença

Projeto para fins educacionais.
