# Como Atualizar os Mapas e o Site

Siga este guia sempre que precisar atualizar os arquivos de mapa (`.kml` ou `.kmz`) ou fazer alterações no site.

## 1. Atualizar os Arquivos de Mapa
1.  Vá até a pasta onde o projeto está no seu computador.
2.  Entre na pasta `frontend` -> `public` -> `maps`.
3.  **Apague** os arquivos antigos (`zone_a.kml`, etc).
4.  **Cole** os novos arquivos de mapa nessa pasta.
    *   *Dica: Tente manter nomes simples, sem espaços ou acentos.*

## 2. Publicar as Mudanças (Terminal)
Abra o terminal na pasta do projeto (`coverage_checker`) e rode os comandos abaixo, um por um:

### Passo A: Salvar no GitHub (Código)
```bash
# 1. Adiciona todas as mudanças
git add .

# 2. Salva com uma mensagem (pode mudar a mensagem entre aspas)
git commit -m "Atualizando mapas"

# 3. Envia para o GitHub
git push
```

### Passo B: Publicar no Site (Ao Vivo)
```bash
# 1. Entra na pasta do site
cd frontend

# 2. Constrói e publica a nova versão
npm run deploy
```

---
**Pronto!** Em cerca de 2 minutos, o site em `https://keyb10.github.io/cobertura-rede/` estará atualizado.
