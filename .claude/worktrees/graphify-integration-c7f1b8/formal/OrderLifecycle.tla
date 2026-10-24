------------------------- MODULE OrderLifecycle -------------------------
(***************************************************************************)
(* Especificação formal do ciclo de vida de uma encomenda — o mesmo        *)
(* domínio de src/order.ts, agora com CONCORRÊNCIA, que os testes não      *)
(* conseguem cobrir de forma exaustiva.                                    *)
(*                                                                         *)
(* O cenário: N processos (webhooks de pagamento, o utilizador no browser, *)
(* um job de limpeza) tentam pagar ou cancelar a MESMA encomenda ao mesmo  *)
(* tempo. Em código real, cada processo faz "ler estado → decidir →        *)
(* escrever" e essas operações NÃO são atómicas entre si.                  *)
(*                                                                         *)
(* O TLC (model checker) explora TODOS os entrelaçamentos possíveis — algo *)
(* que nenhum teste consegue garantir — e verifica os invariantes abaixo.  *)
(*                                                                         *)
(* Esta spec inclui as duas variantes:                                     *)
(*   - Transições GUARDED (com compare-and-set): invariantes seguros.      *)
(*   - Ativa NaivePay/NaiveCancel no .cfg para veres o TLC encontrar o     *)
(*    contra-exemplo da race condition (encomenda paga E depois cancelada).*)
(***************************************************************************)
EXTENDS Naturals

CONSTANT Procs                \* conjunto de processos concorrentes

VARIABLES
    status,                   \* "pending" | "paid" | "cancelled"
    paidCount,                \* nº de vezes que o pagamento foi capturado
    pc                        \* program counter de cada processo (para a variante naive)

vars == <<status, paidCount, pc>>

Statuses == {"pending", "paid", "cancelled"}

Init ==
    /\ status = "pending"
    /\ paidCount = 0
    /\ pc = [p \in Procs |-> "idle"]

(***************************************************************************)
(* Variante CORRETA: transições atómicas com guarda (compare-and-set).     *)
(* Corresponde a payOrder/cancelOrder em src/order.ts, assumindo que a     *)
(* camada de persistência faz a transição de forma atómica                 *)
(* (ex.: UPDATE ... WHERE status = 'pending').                             *)
(***************************************************************************)
Pay(p) ==
    /\ pc[p] = "idle"
    /\ status = "pending"
    /\ status' = "paid"
    /\ paidCount' = paidCount + 1
    /\ UNCHANGED pc

Cancel(p) ==
    /\ pc[p] = "idle"
    /\ status = "pending"
    /\ status' = "cancelled"
    /\ UNCHANGED <<paidCount, pc>>

(***************************************************************************)
(* Variante NAIVE: "ler, depois escrever" em dois passos NÃO atómicos.     *)
(* É o que acontece com  if (order.status === 'pending') { ...pagar... }   *)
(* quando a leitura e a escrita são queries separadas sem lock/CAS.        *)
(* Ativa no .cfg (NEXT NextNaive) e o TLC encontra o contra-exemplo:       *)
(* dois processos leem "pending", um paga, o outro cancela → dinheiro      *)
(* capturado numa encomenda cancelada.                                     *)
(***************************************************************************)
NaiveReadPay(p) ==
    /\ pc[p] = "idle"
    /\ status = "pending"                 \* lê "pending"...
    /\ pc' = [pc EXCEPT ![p] = "willPay"] \* ...e decide pagar (ainda não escreveu)
    /\ UNCHANGED <<status, paidCount>>

NaiveWritePay(p) ==
    /\ pc[p] = "willPay"
    /\ status' = "paid"                   \* escreve SEM revalidar a guarda
    /\ paidCount' = paidCount + 1
    /\ pc' = [pc EXCEPT ![p] = "idle"]

NaiveReadCancel(p) ==
    /\ pc[p] = "idle"
    /\ status = "pending"
    /\ pc' = [pc EXCEPT ![p] = "willCancel"]
    /\ UNCHANGED <<status, paidCount>>

NaiveWriteCancel(p) ==
    /\ pc[p] = "willCancel"
    /\ status' = "cancelled"
    /\ UNCHANGED paidCount
    /\ pc' = [pc EXCEPT ![p] = "idle"]

NextSafe  == \E p \in Procs : Pay(p) \/ Cancel(p)
NextNaive == \E p \in Procs :
                NaiveReadPay(p) \/ NaiveWritePay(p)
             \/ NaiveReadCancel(p) \/ NaiveWriteCancel(p)

SpecSafe  == Init /\ [][NextSafe]_vars
SpecNaive == Init /\ [][NextNaive]_vars

(***************************************************************************)
(* INVARIANTES — o que tem de ser verdade em TODOS os estados alcançáveis. *)
(***************************************************************************)

TypeOK ==
    /\ status \in Statuses
    /\ paidCount \in Nat
    /\ pc \in [Procs -> {"idle", "willPay", "willCancel"}]

\* Nunca capturar pagamento mais do que uma vez (double-charge)
NoDoubleCharge == paidCount <= 1

\* Se a encomenda está cancelada, nunca houve captura de pagamento.
\* (No SpecNaive este invariante É VIOLADO — o TLC mostra o trace exato.)
NoMoneyLost == status = "cancelled" => paidCount = 0

=============================================================================
