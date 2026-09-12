# Cidade Dorme

## Instalar

Use Node.js 22.12 ou superior.

```sh
npm install
```

## Desenvolvimento

```sh
npm run dev
```

Acesse `http://localhost:5173`. Outros dispositivos na mesma rede devem usar o IP do computador, por exemplo `http://192.168.1.10:5173`. Use navegadores ou perfis separados para pessoas diferentes; abas do mesmo navegador compartilham a identificação. A conversa acontece em uma chamada externa.

## Build

```sh
npm run check
npm test
npm run build
npm start
```

O servidor Node atende HTTP e WebSocket na mesma porta (5173 por padrão). `PORT` e `HOST` podem ser configurados. Em hospedagem, use uma única instância e um proxy com suporte a upgrade WebSocket e HTTPS.

## Identificação do Narrador

O primeiro navegador que conectar se torna Narrador. O servidor gera um token aleatório, salvo em `localStorage`, que preserva a identificação após atualizar a página. O Narrador nunca recebe papel. Não compartilhe o token nem a tela do Narrador.

## Identificação dos jogadores

Os demais acessos pedem apenas um nome. Cada jogador recebe um token aleatório; token e nome são salvos em `localStorage`. Reconectar no mesmo navegador e endereço preserva papel e condição vivo/morto, sem duplicar o jogador. Uma desconexão marca o jogador como offline.

São necessários pelo menos 4 jogadores (2 Assassinos, 1 Médico, 1 Detetive; demais Cidadãos). Após o sorteio, novas entradas são fechadas. Cada assassino vota uma vez por noite, sem ver o voto do parceiro; ambos conhecem o parceiro no cartão do papel, sempre visível. O Narrador vê os votos individuais. Votos iguais definem a vítima; votos diferentes exigem que o Narrador escolha um dos alvos antes de acordar a cidade. Todos os Assassinos vivos com alvos disponíveis precisam votar. Médico e Detetive agem uma vez por noite. As ações noturnas são abertas simultaneamente. O Narrador só pode acordar a cidade após todos os jogadores vivos com ação e alvo disponível confirmarem, incluindo os offline (que precisam reconectar). Cidadãos e mortos não precisam confirmar. Ao amanhecer, o servidor conta 60 segundos de discussão. Depois, todos os vivos decidem entre mais 30 segundos e votação; maioria por mais tempo prorroga, empate abre a votação. Na votação secreta, cada vivo escolhe qualquer vivo (inclusive si mesmo). Após todos votarem, o mais votado morre e a noite começa automaticamente. Empates são decididos pelo Narrador entre os mais votados. Só o Narrador recebe votos e contagens. Atualizar a página não reinicia o relógio nem permite votar novamente.

Tudo existe apenas na memória de um processo. Reiniciar o servidor encerra a partida e libera a identificação do Narrador para o primeiro navegador que reconectar.
