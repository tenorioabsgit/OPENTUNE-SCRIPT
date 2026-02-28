# OPENTUNE-SCRIPT - Importador de Música Automático

Script de importação de música criativa commons (CC) do Jamendo para Firebase Firestore.

## ✨ Funcionalidades

- 🎵 Importação de 30 estilos musicais diferentes
- 🔄 Execução automática uma vez por mês via GitHub Actions
- 🔐 Suporte a Firebase Firestore para armazenamento
- 📊 Deduplicação automática de tracks
- 📝 Relatórios detalhados de importação

## 🎵 Estilos Musicais Capturados

- **Rock & Variações**: Rock, Metal, Punk, Hardrock, Hardcore, Progressive, Grunge, Alternative, Indie
- **Metal Especializado**: Postpunk, Stonerrock, Numetal, Metalcore
- **Pop & Urban**: Pop, Hiphop, Rap, Electronic, EDM, Dance
- **Jazz & Blues**: Jazz, Blues
- **Clássica & Ambient**: Classical, Ambient
- **Folk & Acústico**: Folk
- **Mundo & Ritmos**: Country, Reggae, Soul, RNB, Latin, Afrobeat
- **Experimental**: Experimental, Instrumental

## 🚀 Configuração

### 1. Configurar Secrets do GitHub

Acesse: `Settings > Secrets and variables > Actions > New repository secret`

**Secrets obrigatórios:**

#### `JAMENDO_CLIENT_ID`
- Obtenha em: https://www.jamendo.com/api/v3.0
- Copie seu Client ID

#### `FIREBASE_SERVICE_ACCOUNT`
- Arquivo JSON das credenciais do Firebase (base64)
- Execute no terminal:
  ```bash
  cat caminho/para/firebase-key.json | base64
  ```
- Copie a saída e cole como secret

### 2. Deixar repositório público

1. Acesse `Settings > General`
2. Scroll para `Visibility`
3. Clique em `Change visibility`
4. Selecione `Public`
5. Confirme

## 🔧 Execução Manual

Na aba `Actions` do GitHub, clique em `Monthly Music Import` > `Run workflow`

## 📋 Variáveis de Ambiente (Local)

```bash
export JAMENDO_CLIENT_ID="seu_client_id_aqui"
export DRY_RUN="1"  # Para teste sem banco de dados
npm run import-music
```

## 📊 Estratégia de Importação

- **Gêneros por execução**: 5
- **Páginas por gênero**: 5 (≈1.000 músicas/gênero)
- **Total esperado**: ≈5.000 música/execução
- **Frequência**: 1º dia do mês às 00:00 UTC

## 📂 Estrutura do Projeto

```
scripts/import-music/
├── index.ts              # Orquestrador principal
├── firebaseAdmin.ts      # Inicialização do Firebase
├── utils.ts              # Utilitários compartilhados
├── types.ts              # Tipos TypeScript
└── sources/
    └── jamendo.ts        # Fonte: Jamendo API
```

## 🎵 Fonte: Jamendo

- **API**: https://api.jamendo.com/v3.0
- **Licença**: Creative Commons
- **Cobertura**: 30+ estilos musicais
- **Metadados**: Título, Artista, Álbum, Duração, Artwork, Gênero

## 📝 Licença

Creative Commons Attribution
