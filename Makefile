NPM := npm

.PHONY: test typecheck demo live build

build:
	$(NPM) run build

test:
	$(NPM) test

typecheck:
	$(NPM) run typecheck

demo:
	$(NPM) run demo

live:
	$(NPM) run live
