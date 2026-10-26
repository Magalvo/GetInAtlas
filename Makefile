# =============================================================================
# Interface única do projeto — para humanos E agentes.
# O agente não adivinha comandos: lê o AGENTS.md, que aponta para aqui.
# `make check` é o comando que o agente corre obsessivamente até ficar verde.
# =============================================================================

.PHONY: help setup check format typecheck lint test test-unit test-acceptance \
        test-properties validate-specs diff-budget eval formal-setup \
        formal-check formal-demo-race new-item new-track new-spec new-adr

help: ## Lista os comandos disponíveis
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

setup: ## Instala dependências e hooks
	npm install

check: validate-specs format typecheck lint test ## TUDO. O loop do agente: correr até verde.
	@echo ""
	@echo "✓✓✓ Tudo verde. ✓✓✓"

format: ## Formata o código (prettier)
	npx prettier --write . --log-level warn

typecheck: ## Verificação de tipos (tsc --strict)
	npm run typecheck

lint: ## Linter (eslint, regras estritas)
	npm run lint

test: ## Todos os testes (unit + acceptance + properties + workspaces)
	npm run test

test-unit: ## Só testes unitários (loop rápido de TDD)
	npx vitest run tests/unit

test-acceptance: ## Só o contrato (tests/acceptance — intocável pelo agente)
	npx vitest run tests/acceptance

test-properties: ## Só property-based tests
	npx vitest run tests/properties

validate-specs: ## Valida o corpus de specs (schema, refs, órfãos, IDs)
	node scripts/validate-specs.mjs

diff-budget: ## Verifica o orçamento de diff vs origin/main
	node scripts/check-diff-budget.mjs

# ---- Evals (componentes probabilísticos/LLM — ver evals/README.md) ---------

eval: ## Corre os evals contra os thresholds (não incluído no check: custa $$/tempo)
	node scripts/run-evals.mjs

# ---- Métodos formais (OPCIONAL — ver formal/README.md) ---------------------

TLA_JAR := formal/tla2tools.jar
TLA_URL := https://github.com/tlaplus/tlaplus/releases/latest/download/tla2tools.jar

formal-setup: ## Descarrega o model checker TLC (requer Java 11+)
	@test -s $(TLA_JAR) || curl -fL -o $(TLA_JAR) $(TLA_URL)
	@java -version 2>&1 | head -1
	@echo "✓ TLC pronto em $(TLA_JAR)"

formal-check: ## Verifica a spec TLA+ (variante correta — deve passar)
	cd formal && java -XX:+UseParallelGC -cp tla2tools.jar tlc2.TLC \
		-deadlock -workers auto -config OrderLifecycle.cfg OrderLifecycle.tla

formal-demo-race: ## Demo: o TLC encontra a race condition da variante naive
	cd formal && java -XX:+UseParallelGC -cp tla2tools.jar tlc2.TLC \
		-deadlock -workers auto -config OrderLifecycleNaive.cfg OrderLifecycle.tla \
		|| echo "↑ FALHOU COMO ESPERADO: o trace acima é uma race condition. O desenho naive viola AMBOS os invariantes (double-charge e pago→cancelado); o TLC mostra a primeira violação encontrada. Para ver a outra, remove um INVARIANT do .cfg."

# ---- Scaffolding (previne drift estrutural) --------------------------------

new-track: ## Novo work-track: make new-track ID=WT-0002 SLUG=nome-curto
	@test -n "$(ID)" -a -n "$(SLUG)" || (echo "uso: make new-track ID=WT-0002 SLUG=nome" && exit 1)
	@sed "s/{{ID}}/$(ID)/g" .agent/templates/track.md > specs/tracks/$(ID)-$(SLUG).md
	@echo "✓ specs/tracks/$(ID)-$(SLUG).md"
	@echo ""
	@echo "Checklist de arranque do feature (ADR-0006):"
	@echo "  1. Preenche objetivo, âmbito dentro/fora e métrica de sucesso"
	@echo "  2. Verificação de promoção: lê docs/canonical/ primeiro; o que é verdade além deste track vai para lá"
	@echo "  3. Lista os work-items de forma grosseira; parte só os próximos 1-2"
	@echo "  4. make new-spec ITEM=WI-NNNN e aprovação humana antes de qualquer código"

new-item: ## Novo work-item: make new-item ID=WI-0002 SLUG=nome-curto TRACK=WT-0001
	@test -n "$(ID)" -a -n "$(SLUG)" -a -n "$(TRACK)" || (echo "uso: make new-item ID=WI-0002 SLUG=nome TRACK=WT-0001" && exit 1)
	@sed -e "s/{{ID}}/$(ID)/g" -e "s/{{TRACK}}/$(TRACK)/g" .agent/templates/work-item.md > specs/items/$(ID)-$(SLUG).md
	@echo "✓ specs/items/$(ID)-$(SLUG).md"

new-spec: ## Nova work-spec de um item: make new-spec ITEM=WI-0002
	@test -n "$(ITEM)" || (echo "uso: make new-spec ITEM=WI-0002" && exit 1)
	@node scripts/new-spec.mjs $(ITEM)

new-adr: ## Novo ADR: make new-adr NUM=0002 SLUG=nome-curto
	@test -n "$(NUM)" -a -n "$(SLUG)" || (echo "uso: make new-adr NUM=0002 SLUG=nome" && exit 1)
	@sed "s/{{NUM}}/$(NUM)/g" .agent/templates/adr.md > docs/adr/$(NUM)-$(SLUG).md
	@echo "✓ docs/adr/$(NUM)-$(SLUG).md"
