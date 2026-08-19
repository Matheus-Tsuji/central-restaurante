# 🍽️ Central Restaurante - Backend Multi-telas

Sistema backend robusto e completo para gestão centralizada de restaurantes com suporte a múltiplas telas em tempo real (Caixa, Garçom, Cozinha KDS e Estoque), arquitetura em camadas, banco de dados relacional atômico (SQLite), WebSockets (Socket.IO) e suporte a sincronização offline para garçons.

---

## 📐 Arquitetura do Projeto

O sistema foi desenvolvido utilizando a **Arquitetura em Camadas (Layered Architecture)**, garantindo forte desacoplamento, testabilidade e separação de responsabilidades:

```text
src/
├── config/             # Configurações do ambiente e banco de dados SQLite (better-sqlite3)
├── utils/              # Criptografia scrypt, hash de senhas e gerador de tokens JWT
├── models/             # Interfaces e Tipos TypeScript centralizados
├── repositories/       # Camada de Persistência e Acesso a Dados (SQL queries atômicas)
├── services/           # Camada de Negócio, transações, regras e baixa de estoque por ficha técnica
├── middlewares/        # Autenticação JWT, autorização RBAC, validação Zod e Error Handling
├── controllers/        # Camada de Apresentação HTTP (Requisição/Resposta)
├── routes/             # Definição e roteamento das rotas RESTful da API
├── sockets/            # Gerenciador de WebSockets em tempo real (Socket.IO)
└── server.ts           # Inicialização do servidor Express + Socket.IO + Seed
```

---

## 🚀 Principais Módulos do Sistema

### 1. 📦 Estoque & Ficha Técnica
- Cadastro e controle de saldo de matérias-primas/insumos (`kg`, `un`, `g`, `litro`).
- Alertas de estoque baixo (`quantity <= min_quantity`).
- **Baixa Automática no Estoque**: Ao lançar um pedido, o sistema abate automaticamente os insumos necessários de acordo com a ficha técnica do produto. Rejeita o pedido em caso de saldo insuficiente.

### 2. 📱 Garçom & Mesas
- Gerenciamento de status das mesas (`FREE` 🟢, `OCCUPIED` 🔴, `PAYMENT_PENDING` 🟡).
- Lançamento de pedidos por mesa com observações personalizadas por item.
- Extrato/conta da mesa atualizada em tempo real.
- **Sincronização Offline de Pedidos**: Rota `/api/orders/sync-batch` que recebe um lote de pedidos armazenados no IndexedDB do app do garçom quando a conexão Wi-Fi cai e retorna.

### 3. 🍳 Cozinha (KDS - Kitchen Display System)
- Visualização da fila de pedidos em tempo real via WebSockets (Socket.IO).
- Transição de status por item (`PENDING` ➡️ `PREPARING` ➡️ `READY`).
- Notificação automática para a tela do garçom assim que os pratos ficam prontos.

### 4. 💰 Caixa (POS & Relatório Diário)
- Controle de abertura e fechamento de sessão de caixa com saldo inicial e final.
- Fechamento da conta da mesa com seleção de múltiplas formas de pagamento (Dinheiro, Cartão de Crédito, Cartão de Débito, PIX).
- Cálculo automático de troco para pagamentos em dinheiro e liberação imediata da mesa.
- **Relatório Final do Dia (`GET /api/cashier/report`)**: Totais por meio de pagamento, fechamento do caixa, **relatório de cada pedido por mesa** (itens, quantidades, valores, garçom responsável e horários) e alertas de estoque.

---

## 🔐 Segurança e Criptografia

- **Hash de Senhas**: Armazenamento com `scryptSync` + `salt` aleatório de 16 bytes e derivação de chave de 64 bytes (`node:crypto`).
- **Tokens JWT Seguros**: Autenticação com tokens assinados via HMAC SHA-256 e expiração configurável.
- **Controle de Acesso por Papel (RBAC)**: Proteção de rotas por perfis (`ADMIN`, `CASHIER`, `WAITER`, `KITCHEN`).
- **Validação com Zod**: Validação estrita de todos os tipos e payloads de requisição.
- **Transações Atômicas no SQLite**: Execução com `db.transaction()`, suporte a chaves estrangeiras (`PRAGMA foreign_keys = ON`) e alto desempenho com modo `WAL`.

---

## 🛠️ Tecnologias Utilizadas

- **Node.js** & **TypeScript**
- **Express 5** (Framework Web)
- **SQLite** com `better-sqlite3` (Banco de dados de alta performance)
- **Socket.IO** (Comunicação em tempo real para WebSockets)
- **Zod** (Validação de schemas)
- **node:crypto** (Criptografia nativa e hash de senhas)

---

## ⚡ Como Executar o Projeto

### Pré-requisitos
- Node.js v18+ instalado.

### Passo a passo
1. Clone o repositório:
```bash
git clone https://github.com/Matheus-Tsuji/central-restaurante.git
cd central-restaurante
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor em modo de desenvolvimento:
```bash
npm run dev
```

O servidor estará rodando em: `http://localhost:3000`

---

## 🔑 Credenciais Padrão (Seed Inicial)

O sistema popula automaticamente o banco de dados inicial na primeira execução:

| Função | Usuário | Senha |
| :--- | :--- | :--- |
| **Administrador** | `admin` | `admin123` |
| **Caixa** | `caixa` | `caixa123` |
| **Garçom** | `garcom` | `garcom123` |
| **Cozinha** | `cozinha` | `cozinha123` |

---

## 📖 Documentação dos Endpoints REST

### 🔓 Autenticação
- `POST /api/auth/login` - Autenticar usuário e obter Token Bearer
- `POST /api/auth/register` - Cadastrar novo usuário (Requer ADMIN)
- `GET /api/auth/users` - Listar usuários cadastrados (Requer ADMIN)

### 📦 Estoque
- `GET /api/inventory` - Listar todos os insumos
- `GET /api/inventory/alerts` - Listar insumos em estado de alerta (estoque baixo)
- `POST /api/inventory` - Cadastrar novo insumo (Requer ADMIN)
- `PATCH /api/inventory/:id/adjust` - Ajustar quantidade manual de um insumo

### 🍔 Cardápio
- `GET /api/menu-items` - Listar produtos do cardápio com ficha técnica
- `GET /api/menu-items/:id` - Buscar produto por ID
- `POST /api/menu-items` - Cadastrar produto com ingredientes (Requer ADMIN)

### 🪑 Mesas
- `GET /api/tables` - Listar todas as mesas e seus status
- `GET /api/tables/:id` - Buscar detalhes de uma mesa
- `POST /api/tables` - Cadastrar nova mesa (Requer ADMIN)
- `PATCH /api/tables/:id/status` - Alterar status da mesa

### 📝 Pedidos (Garçom)
- `POST /api/orders` - Criar novo pedido para uma mesa
- `POST /api/orders/sync-batch` - Sincronizar lote de pedidos offline do garçom
- `GET /api/orders/table/:tableId/bill` - Consultar a conta/extrato atual de uma mesa
- `GET /api/orders/:id` - Buscar pedido por ID

### 🍳 Cozinha (KDS)
- `GET /api/kitchen/queue` - Listar fila de pedidos ativos da cozinha
- `PATCH /api/kitchen/item/:itemId/status` - Atualizar status do item (`PENDING`, `PREPARING`, `READY`)

### 💰 Caixa & Relatório Diário
- `GET /api/cashier/session` - Consultar sessão de caixa aberta
- `POST /api/cashier/session/open` - Abrir sessão do caixa
- `POST /api/cashier/session/close` - Fechar sessão do caixa
- `POST /api/cashier/payment` - Processar pagamento da conta da mesa
- `GET /api/cashier/report` - Gerar relatório final do dia (`?date=YYYY-MM-DD`)

---

## 📡 Eventos WebSocket (Socket.IO)

- Conexão em: `ws://localhost:3000`
- Salas disponíveis: `kitchen`, `waiter`, `cashier`
- **Eventos em Tempo Real**:
  - `order:created`: Notifica novo pedido para a Cozinha e o Caixa.
  - `order:status_changed`: Notifica alteração de status do prato para Garçom e Cozinha.
  - `table:status_changed`: Notifica alteração no status da mesa para Garçons e Caixa.
  - `payment:processed`: Notifica pagamento realizado e liberação da mesa.

---

## 📄 Licença

Este projeto está sob a licença [ISC](LICENSE).
