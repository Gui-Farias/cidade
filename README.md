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

Composição por número de jogadores: Assassino → Médico → Vidente → Xerife → Cidadão → segundo Assassino → Guarda-costas → Rei Louco → Detetive. Depois, entram apenas Cidadãos, com limite de 2 Assassinos. Essa ordem monta o baralho, que é embaralhado antes de atribuir os papéis. Com 9 jogadores: 2 Assassinos, 1 Médico, 1 Vidente, 1 Xerife, 1 Guarda-costas, 1 Rei Louco, 1 Detetive e 1 Cidadão. Com 1 ou 2 jogadores, os assassinos vencem imediatamente; use pelo menos 3 para disputar. O Narrador não entra nessa contagem.

As ações noturnas são simultâneas e individuais. Os assassinos conhecem seus parceiros, mas só o Narrador vê os votos: alvos diferentes são sorteados automaticamente (40% para cada alvo e 20% para ambos). Com três alvos diferentes, há 80% de chance de um ataque e 20% de dois, escolhidos igualmente. O Médico não pode se proteger; sua proteção salva o alvo mesmo em um ataque duplo. Todos os vivos com ação disponível precisam confirmar, incluindo offline. Ao amanhecer há 80 segundos de discussão e uma decisão coletiva entre mais 30 segundos e votação secreta. Cada dia permite no máximo duas prorrogações de 30 segundos; ao terminar a segunda, a votação abre automaticamente. Cada jogador pode escolher “Não votar nesta rodada”: a abstenção é secreta, não conta contra ninguém e, se todos se abstiverem, a próxima noite começa sem eliminação. A cidade elimina o mais votado; empates ficam com o Narrador.

A cidade vence sem assassinos vivos; os assassinos vencem ao igualar ou superar os demais vivos. O encerramento revela papéis e uma linha do tempo, preservando o sigilo dos votos individuais. O Narrador pode jogar novamente com o mesmo grupo e novos papéis, ou limpar a sala. Refresh preserva o resultado e a identidade. O resumo existe apenas durante essa partida e é apagado ao recomeçar.

Tudo existe apenas na memória de um processo. Reiniciar o servidor encerra a partida e libera a identificação do Narrador para o primeiro navegador que reconectar.

O Xerife pode atirar duas vezes por partida, durante a noite, ou guardar as balas para outra noite. Cada tiro confirmado gasta uma bala mesmo se a vítima for protegida. O Detetive investiga uma pessoa por noite e recebe apenas se ela é Assassina ou não; o Vidente continua vendo o papel exato. O Guarda-costas protege outra pessoa: se ela for atacada, ele morre em seu lugar. A proteção do Médico é aplicada primeiro; um sacrifício não é impedido por proteção no próprio Guarda-costas. Ataques da mesma noite são simultâneos, inclusive se o protetor ou o Xerife morrerem. Essas proteções não se aplicam à votação diurna.

A Vidente descobre o papel exato de outra pessoa a cada noite; somente ela recebe a visão, e o Narrador vê quem foi consultado. O Rei Louco vence sozinho somente se for eliminado na votação da cidade, incluindo desempate do Narrador. Morrer por tiro ou ataque noturno não dá vitória. A eliminação pelo povo encerra a partida com sua vitória individual.
