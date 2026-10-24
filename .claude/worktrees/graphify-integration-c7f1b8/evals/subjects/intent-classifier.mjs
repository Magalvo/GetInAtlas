/**
 * SUBJECT sob avaliação — classificador de intenções de apoio ao cliente.
 *
 * Contrato: export default async function classify(text) → uma das labels:
 *   cancel_order | track_order | return_item | refund | change_order |
 *   invoice | human_agent
 *
 * Esta versão é uma heurística determinística que faz de "modelo", para o
 * boilerplate correr offline e sem chaves de API. É deliberadamente imperfeita
 * (~0.93 no dataset): num eval, 100% é suspeito — normalmente significa dataset
 * fácil demais, não sistema perfeito.
 *
 * Para usar um LLM real, substitui o corpo por algo como:
 *
 *   const res = await fetch('https://api.anthropic.com/v1/messages', {
 *     method: 'POST',
 *     headers: {
 *       'content-type': 'application/json',
 *       'x-api-key': process.env.ANTHROPIC_API_KEY,
 *       'anthropic-version': '2023-06-01',
 *     },
 *     body: JSON.stringify({
 *       model: 'claude-haiku-4-5',
 *       max_tokens: 10,
 *       system: 'Classifica a intenção. Responde APENAS com uma label: ...',
 *       messages: [{ role: 'user', content: text }],
 *     }),
 *   });
 *   const data = await res.json();
 *   return data.content[0].text.trim();
 *
 * O runner, o dataset e os thresholds não mudam — só o subject.
 * (Nota: o prompt do classificador também é "contrato informal"; se o mudares,
 * corre `make eval` antes do merge.)
 */

const RULES = [
  { label: 'invoice', patterns: [/fatura/i, /recibo/i, /\bnif\b/i] },
  { label: 'refund', patterns: [/reembols/i, /dinheiro de volta/i, /cobrad[oa]/i] },
  {
    label: 'cancel_order',
    patterns: [/cancel/i, /anul[oa]/i, /já não quero/i],
    unless: [/ignorem o cancelamento/i, /anular a devolução/i],
  },
  { label: 'return_item', patterns: [/devolu/i, /devolver/i, /trocar em vez/i] },
  {
    label: 'change_order',
    patterns: [/mudar/i, /trocar o tamanho/i, /adiar/i, /morada/i, /ignorem o cancelamento/i],
  },
  {
    label: 'track_order',
    patterns: [
      /onde (está|anda)/i,
      /estado da encomenda/i,
      /rastreio/i,
      /não recebi/i,
      /entregou/i,
    ],
  },
];

export default async function classify(text) {
  for (const rule of RULES) {
    const blocked = rule.unless?.some((p) => p.test(text)) ?? false;
    if (!blocked && rule.patterns.some((p) => p.test(text))) {
      return rule.label;
    }
  }
  return 'human_agent'; // fallback: na dúvida, encaminhar para humano
}
