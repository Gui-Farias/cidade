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

Acesse `http://localhost:5173`. Outros dispositivos na mesma rede devem usar o IP do computador, por exemplo `http://192.168.1.10:5173`. Para compartilhar o convite na rede local, crie a sala usando esse IP; um link com `localhost` só funciona no próprio computador. Use navegadores ou perfis separados para pessoas diferentes na mesma sala; abas do mesmo navegador compartilham a identificação daquela sala. A conversa acontece em uma chamada externa.

## Build

```sh
npm run check
npm test
npm run build
npm start
```

O servidor Node atende HTTP e WebSocket na mesma porta (5173 por padrão). `PORT` e `HOST` podem ser configurados. Em hospedagem, use uma única instância e um proxy com suporte a upgrade WebSocket e HTTPS.

## Salas simultâneas

Na página inicial, escolha **Criar sala** para se tornar Narrador ou **Entrar com código** para encontrar um grupo. Cada sala recebe um código aleatório de 8 caracteres, como `ABCD-2345`, e um convite no formato `/sala/ABCD-2345`. O convite não contém tokens de identificação. Códigos podem ser digitados com ou sem hífen, em maiúsculas ou minúsculas.

Cada sala tem sua própria partida, jogadores, Narrador, votos, relógio e histórico. Criar, reiniciar ou limpar uma sala não afeta as demais. Um navegador pode ser Narrador em uma sala e jogador em outra. Para voltar, use o mesmo navegador e o convite ou código da sala.

As salas permanecem na memória enquanto houver alguém conectado, incluindo o Narrador. Quando a última conexão sai, começa o prazo de **2 horas**; uma reconexão dentro desse prazo preserva a partida e cancela a expiração. O servidor verifica salas vazias a cada minuto e também antes de criar ou acessar uma sala. Salas inexistentes ou expiradas mostram um aviso; abrir um convite nunca cria uma sala automaticamente. Há um limite preventivo de 200 salas armazenadas por processo, definido em `RoomManager`; isso não representa uma garantia de capacidade e deve ser ajustado após testes de carga.

## Identificação do Narrador

Quem cria a sala se torna Narrador. O servidor gera um token aleatório, salvo em `localStorage` com uma chave específica da sala, que preserva a identificação após atualizar a página. O Narrador nunca recebe papel. Não compartilhe o token nem a tela do Narrador. O Narrador pode fechar a sala a qualquer momento; todos os participantes voltam à página inicial e o convite deixa de funcionar.

## Identificação dos jogadores

Os demais acessos ao convite pedem apenas um nome. Cada jogador recebe um token aleatório; token e nome são salvos em `localStorage` por sala. Reconectar no mesmo navegador e endereço da sala preserva papel e condição vivo/morto, sem duplicar o jogador. Uma desconexão marca o jogador como offline quando sua última aba naquela sala fecha.

Composição por número de jogadores: Assassino → Médico → Vidente → Xerife → Cidadão → segundo Assassino → Guarda-costas → Rei Louco → Detetive. Depois, entram apenas Cidadãos, com limite de 2 Assassinos. Essa ordem monta o baralho, que é embaralhado antes de atribuir os papéis. Com 9 jogadores: 2 Assassinos, 1 Médico, 1 Vidente, 1 Xerife, 1 Guarda-costas, 1 Rei Louco, 1 Detetive e 1 Cidadão. Com 1 ou 2 jogadores, os assassinos vencem imediatamente; use pelo menos 3 para disputar. O Narrador não entra nessa contagem.

As ações noturnas são simultâneas e individuais. Os assassinos conhecem seus parceiros, mas só o Narrador vê os votos: alvos diferentes são sorteados automaticamente (40% para cada alvo e 20% para ambos). Com três alvos diferentes, há 80% de chance de um ataque e 20% de dois, escolhidos igualmente. O Médico não pode se proteger; sua proteção salva o alvo mesmo em um ataque duplo. Todos os vivos com ação disponível precisam confirmar, incluindo offline. Ao amanhecer há 80 segundos de discussão e uma decisão coletiva entre mais 30 segundos e votação secreta. Cada dia permite no máximo duas prorrogações de 30 segundos; ao terminar a segunda, a votação abre automaticamente. Cada jogador pode escolher “Não votar nesta rodada”: a abstenção é secreta, não conta contra ninguém e, se todos se abstiverem, a próxima noite começa sem eliminação. A cidade elimina o mais votado; em empate, o servidor sorteia automaticamente uma pessoa entre as mais votadas.

A cidade vence sem assassinos vivos; os assassinos vencem ao igualar ou superar os demais vivos. O encerramento revela papéis e uma linha do tempo, preservando o sigilo dos votos individuais. O Narrador pode jogar novamente com o mesmo grupo e novos papéis, ou limpar a sala. Refresh preserva o resultado e a identidade. O resumo existe apenas durante essa partida e é apagado ao recomeçar.

Tudo existe apenas na memória de um processo. Reiniciar o servidor encerra todas as salas e invalida os convites antigos; os grupos precisam criar novas salas. Não há banco de dados nem sincronização entre processos nesta etapa. Ao atualizar da versão com sala única, encerre a partida atual antes de reiniciar o servidor.

O Xerife pode atirar duas vezes por partida, durante a noite, ou guardar as balas para outra noite. Cada tiro confirmado gasta uma bala mesmo se a vítima for protegida. O Detetive investiga uma pessoa por noite e recebe apenas se ela é Assassina ou não; o Vidente continua vendo o papel exato. O Guarda-costas protege outra pessoa: se ela for atacada, ele morre em seu lugar. A proteção do Médico é aplicada primeiro; um sacrifício não é impedido por proteção no próprio Guarda-costas. Ataques da mesma noite são simultâneos, inclusive se o protetor ou o Xerife morrerem. Essas proteções não se aplicam à votação diurna.

A Vidente descobre o papel exato de outra pessoa a cada noite; somente ela recebe a visão, e o Narrador vê quem foi consultado. O Rei Louco vence sozinho somente se for eliminado na votação da cidade, inclusive quando for sorteado em um empate. Morrer por tiro ou ataque noturno não dá vitória. A eliminação pelo povo encerra a partida com sua vitória individual.
