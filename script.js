/* ============================================================
   CONFIGURAÇÃO DOS SÍMBOLOS E PESOS
============================================================ */
const SYMBOLS = ['🍋', '🍒', '🍇', '7️⃣', '💎'];
const WEIGHTS = [5, 10, 20, 40, 40];

// Monta o pool de cada reel (quanto mais peso, mais aparece)
const REEL_POOL = [];
for (let i = 0; i < SYMBOLS.length; i++)
  for (let j = 0; j < WEIGHTS[i]; j++)
    REEL_POOL.push(i);

// Slots "miss" para garantir o RTP ~85%
for (let i = 0; i < 9; i++) REEL_POOL.push(-1);

// Multiplicadores de cada combinação tripla
const PAYOUTS = {
  '4,4,4': 50,
  '3,3,3': 20,
  '2,2,2': 10,
  '1,1,1': 5,
  '0,0,0': 3,
};

/* ============================================================
   ESTADO DO JOGO
============================================================ */
let balance        = 100;
let startBalance   = 100;
let rounds         = 0;
let wins           = 0;
let totalBet       = 0;
let totalWon       = 0;
let balanceHistory = [100];
let autoRunning    = false;
let autoTimer      = null;
let spinning       = false;
let autoCount      = 0;

/* ============================================================
   FUNÇÕES AUXILIARES
============================================================ */
function spinReel() {
  return REEL_POOL[Math.floor(Math.random() * REEL_POOL.length)];
}

function getSymbol(idx) {
  return idx < 0 ? '⬜' : SYMBOLS[idx];
}

function calcPayout(r0, r1, r2, bet) {
  if (r0 < 0 || r1 < 0 || r2 < 0) {
    if (r0 === r1 || r1 === r2 || r0 === r2) return bet * 0.5;
    return 0;
  }
  const key = r0 + ',' + r1 + ',' + r2;
  if (PAYOUTS[key]) return bet * PAYOUTS[key];
  if (r0 === r1 || r1 === r2 || r0 === r2) return bet * 0.5;
  return 0;
}

/* ============================================================
   ATUALIZAÇÃO DE ESTATÍSTICAS NA TELA
============================================================ */
function updateStats() {
  const lost = Math.max(0, totalBet - totalWon);
  const bet  = parseInt(document.getElementById('bet-select').value);

  const balEl = document.getElementById('balance');
  balEl.textContent = 'R$ ' + balance.toFixed(2);
  balEl.className   = 'stat-value' + (balance < startBalance ? ' danger' : ' success');

  document.getElementById('total-lost').textContent = 'R$ ' + lost.toFixed(2);
  document.getElementById('rounds').textContent     = rounds;
  document.getElementById('win-rate').textContent   = rounds > 0
    ? (wins / rounds * 100).toFixed(1) + '%'
    : '—';

  document.getElementById('expected-loss').textContent = 'R$ ' + (bet * 100 * 0.15).toFixed(2);

  const pct = totalBet > 0 ? Math.min(100, lost / totalBet * 100) : 0;
  document.getElementById('loss-label').textContent = 'R$ ' + lost.toFixed(2) + ' perdido';
  document.getElementById('loss-pct').textContent   = pct.toFixed(1) + '%';
  document.getElementById('loss-bar').style.width   = Math.min(100, pct * 6.67) + '%';

  const infoBox      = document.getElementById('info-box');
  const expectedLoss = totalBet * 0.15;
  if (rounds >= 50 && balance < startBalance * 0.5) {
    infoBox.innerHTML = '<strong>Atenção:</strong> Você perdeu mais de 50% do seu saldo em '
      + rounds + ' rodadas. Isso é exatamente o que os dados estatísticos preveem — '
      + 'a vantagem da casa é implacável no longo prazo. Em cassinos reais, não há botão de reiniciar.';
  } else if (rounds >= 20) {
    infoBox.innerHTML = '<strong>Você sabia?</strong> Com RTP de 85%, a perda esperada após '
      + rounds + ' rodadas de R$' + bet + ' é <strong>R$ ' + expectedLoss.toFixed(2)
      + '</strong>. Sua perda real: R$ ' + lost.toFixed(2)
      + '. O resultado pode variar, mas a média sempre favorece a casa.';
  }
}

/* ============================================================
   GRÁFICO
============================================================ */
let chart;

function initChart() {
  const ctx = document.getElementById('balanceChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['0'],
      datasets: [
        {
          label: 'Saldo',
          data: [100],
          borderColor: '#e24b4a',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          fill: { target: 'origin', above: 'rgba(226,75,74,0.06)' },
        },
        {
          label: 'Saldo inicial',
          data: [100],
          borderColor: 'rgba(59,109,17,0.5)',
          borderWidth: 1,
          borderDash: [4, 3],
          pointRadius: 0,
          tension: 0,
        }
      ]
    },
    options: {
      responsive: true,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => 'R$ ' + ctx.raw.toFixed(2) }
        }
      },
      scales: {
        x: {
          ticks: { color: '#999', maxTicksLimit: 8, font: { size: 11 } },
          grid:  { color: 'rgba(0,0,0,0.06)' }
        },
        y: {
          ticks: { color: '#999', font: { size: 11 }, callback: v => 'R$' + v.toFixed(0) },
          grid:  { color: 'rgba(0,0,0,0.06)' }
        }
      }
    }
  });
}

function updateChart() {
  chart.data.labels           = balanceHistory.map((_, i) => i);
  chart.data.datasets[0].data = balanceHistory;
  chart.data.datasets[1].data = balanceHistory.map(() => startBalance);
  chart.update('none');
}

/* ============================================================
   GIRAR (com animação)
============================================================ */
function doSpin() {
  if (spinning) return;
  const bet = parseInt(document.getElementById('bet-select').value);
  if (balance < bet) {
    document.getElementById('result-msg').textContent = 'Saldo insuficiente!';
    document.getElementById('result-msg').className  = 'result-msg lose';
    if (autoRunning) toggleAuto();
    return;
  }

  spinning = true;
  document.getElementById('btn-spin').disabled = true;
  balance  -= bet;
  totalBet += bet;
  rounds++;

  const reels = [
    document.getElementById('r0'),
    document.getElementById('r1'),
    document.getElementById('r2')
  ];
  reels.forEach(r => r.classList.add('spin'));

  const r0 = spinReel(), r1 = spinReel(), r2 = spinReel();

  setTimeout(() => {
    reels[0].textContent = getSymbol(r0);
    reels[0].classList.remove('spin');
    setTimeout(() => {
      reels[1].textContent = getSymbol(r1);
      reels[1].classList.remove('spin');
      setTimeout(() => {
        reels[2].textContent = getSymbol(r2);
        reels[2].classList.remove('spin');

        const payout = calcPayout(r0, r1, r2, bet);
        balance  += payout;
        totalWon += payout;
        if (payout > 0) wins++;

        const msg = document.getElementById('result-msg');
        if (payout >= bet * 3) {
          msg.textContent = '🎉 GRANDE PRÊMIO! +R$ ' + payout.toFixed(2);
          msg.className   = 'result-msg win';
        } else if (payout > 0) {
          msg.textContent = 'Ganhou R$ ' + payout.toFixed(2) + ' (aposta: R$ ' + bet.toFixed(2) + ')';
          msg.className   = payout >= bet ? 'result-msg win' : 'result-msg lose';
        } else {
          msg.textContent = 'Perdeu R$ ' + bet.toFixed(2);
          msg.className   = 'result-msg lose';
        }

        balanceHistory.push(parseFloat(balance.toFixed(2)));
        updateChart();
        updateStats();
        spinning = false;
        document.getElementById('btn-spin').disabled = false;
      }, 120);
    }, 120);
  }, 120);
}

/* ============================================================
   GIRAR RÁPIDO (sem animação — usado no Auto)
============================================================ */
function fastSpin() {
  const bet = parseInt(document.getElementById('bet-select').value);
  if (balance < bet) { toggleAuto(); return; }

  balance  -= bet;
  totalBet += bet;
  rounds++;

  const r0 = spinReel(), r1 = spinReel(), r2 = spinReel();
  const payout = calcPayout(r0, r1, r2, bet);
  balance  += payout;
  totalWon += payout;
  if (payout > 0) wins++;

  document.getElementById('r0').textContent = getSymbol(r0);
  document.getElementById('r1').textContent = getSymbol(r1);
  document.getElementById('r2').textContent = getSymbol(r2);

  balanceHistory.push(parseFloat(balance.toFixed(2)));
}

/* ============================================================
   AUTO-GIRAR
============================================================ */
function toggleAuto() {
  autoRunning = !autoRunning;
  const btn = document.getElementById('btn-auto');

  if (autoRunning) {
    btn.textContent = 'Parar';
    btn.classList.add('active');
    autoCount = 0;
    autoTimer = setInterval(() => {
      const bet = parseInt(document.getElementById('bet-select').value);
      if (balance < bet || autoCount >= 50) { toggleAuto(); return; }
      fastSpin();
      autoCount++;
      if (autoCount % 5 === 0) { updateChart(); updateStats(); }
    }, 30);
  } else {
    clearInterval(autoTimer);
    btn.textContent = 'Auto (50x)';
    btn.classList.remove('active');
    updateChart();
    updateStats();
  }
}

/* ============================================================
   REINICIAR
============================================================ */
function resetGame() {
  balance        = 100;
  startBalance   = 100;
  rounds         = 0;
  wins           = 0;
  totalBet       = 0;
  totalWon       = 0;
  balanceHistory = [100];

  ['r0', 'r1', 'r2'].forEach(id => document.getElementById(id).textContent = '🍋');
  document.getElementById('result-msg').textContent = 'Pressione girar para começar';
  document.getElementById('result-msg').className  = 'result-msg';
  document.getElementById('info-box').innerHTML =
    '<strong>Como funciona a vantagem da casa?</strong> Neste simulador, o RTP (Return to Player) é de 85%, '
    + 'ou seja, a cada R$100 apostados, em média apenas R$85 voltam para o jogador. '
    + 'A diferença de R$15 fica com a casa — sempre. Quanto mais você joga, mais essa perda se acumula.';

  if (autoRunning) toggleAuto();
  updateChart();
  updateStats();
}

/* ============================================================
   INICIALIZAÇÃO
============================================================ */
window.addEventListener('load', () => {
  initChart();
  updateStats();
});