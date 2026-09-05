PYTHON := python3

.PHONY: test demo live

test:
	$(PYTHON) -m unittest discover -s tests -v

demo:
	$(PYTHON) -m painradar --fixture fixtures/sample_posts.json --out-json reports/demo.json --out-html reports/demo.html

live:
	$(PYTHON) -m painradar --live smallbusiness,freelance,startups --max-items 15 --timeout 8 --delay 2 \
		--out-json reports/live.json --out-html reports/live.html
