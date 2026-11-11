# Chess — checks. Needs Go (fetches the tools on first use).
FRAMEWORK := github.com/timeofmind/data-driven-framework-go/cmd/ddframework@v0.30.1
CADDY     := github.com/timeofmind/data-driven-framework-caddy2/cmd/caddy@v0.25.0
MODEL     := $(addprefix --schema ,$(sort $(wildcard model/*.yaml)))
PAGES     := $(addprefix --pages ,$(sort $(wildcard pages/*.yaml)))
TMP       := $(shell mktemp -d)

.PHONY: check validate config report
check: validate config

validate:            ## the data model (every expression too) and every page against it
	go run $(FRAMEWORK) validate $(MODEL) $(PAGES)

config:              ## the whole app (manifest, model, pages, theme) loads in the handler
	CHESS_APP=$(CURDIR) CHESS_DATA=$(TMP) CHESS_DB=$(TMP)/players.db CHESS_ADMINS=nobody@example.org CHESS_TOKEN_KEY=/dev/null \
	  CHESS_SMTP_HOST=127.0.0.1 CHESS_SMTP_PORT=25 CHESS_MAIL_FROM=chess@example.org \
	  go run $(CADDY) validate --adapter caddyfile --config Caddyfile.check
	rm -rf $(TMP)

report:              ## which pages read and write each class and field
	go run $(FRAMEWORK) pages-report $(MODEL) $(PAGES)
