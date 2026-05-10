# ============================================================
# Currency Display Control — Makefile
#
# Single source of truth for version: vss-extension.json
#
# Common flows:
#   make build                          # webpack production build
#   make package                        # build + .vsix into releases/
#   make release MSG="release notes"    # build + package + local tag (no push)
#   make release-push                   # push the most recent tag + branch
#   make publish-marketplace            # publish to VS Marketplace (requires PAT)
# ============================================================

RELEASES := releases

# Read manifest metadata via Node (already a build dependency — no python3 needed)
VERSION   := $(shell node -p "require('./vss-extension.json').version" 2>/dev/null)
PUBLISHER := $(shell node -p "require('./vss-extension.json').publisher" 2>/dev/null)
EXT_ID    := $(shell node -p "require('./vss-extension.json').id" 2>/dev/null)
VSIX      := $(PUBLISHER).$(EXT_ID)-$(VERSION).vsix

# Current git branch (falls back to 'main' outside a git repo)
BRANCH    := $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)

MSG      ?= Release v$(VERSION)

.PHONY: all help check-manifest install typecheck test build audit \
        package tag release release-push publish-marketplace clean version

# ── Default target ───────────────────────────────────────────
all: help

# ── Guard: ensure manifest parsed successfully ───────────────
check-manifest:
	@if [ -z "$(VERSION)" ] || [ -z "$(PUBLISHER)" ] || [ -z "$(EXT_ID)" ]; then \
		echo "ERROR: failed to read vss-extension.json. Check the file exists and is valid JSON."; \
		exit 1; \
	fi

# ── Install dependencies ─────────────────────────────────────
install:
	@echo "Installing dependencies..."
	npm install --no-audit --no-fund

# ── Type-check only (fast feedback) ──────────────────────────
typecheck:
	npm run typecheck

# ── Unit tests ───────────────────────────────────────────────
test:
	npm test

# ── Build (clean + typecheck + webpack) ──────────────────────
build: check-manifest
	@echo "Building $(EXT_ID) v$(VERSION)..."
	npm run build

# ── Vulnerability scan (high+ only) ──────────────────────────
audit:
	npm audit --audit-level=high || true

# ── Package .vsix into ./releases ────────────────────────────
package: build
	@echo "Packaging v$(VERSION)..."
	./node_modules/.bin/tfx extension create --manifest-globs vss-extension.json
	@mkdir -p $(RELEASES)
	@mv $(VSIX) $(RELEASES)/
	@echo "Done -> $(RELEASES)/$(VSIX)"

# ── Local tag (no push) ──────────────────────────────────────
tag: check-manifest
	@echo "Tagging v$(VERSION) on branch $(BRANCH)..."
	@if git rev-parse v$(VERSION) >/dev/null 2>&1; then \
		echo "Tag v$(VERSION) already exists. Bump version in vss-extension.json first."; \
		exit 1; \
	fi
	git add vss-extension.json
	@git diff --cached --quiet || git commit -m "chore: release v$(VERSION)"
	git tag -a v$(VERSION) -m "$(MSG)"
	@echo "Tagged v$(VERSION) locally. Run 'make release-push' to push to origin."

# ── Local release: build + package + tag (no push) ───────────
release: test build package tag
	@echo ""
	@echo "================================================="
	@echo "  Release v$(VERSION) prepared (NOT yet pushed)"
	@echo "  vsix : $(RELEASES)/$(VSIX)"
	@echo "  tag  : v$(VERSION) (local only)"
	@echo ""
	@echo "  Next: make release-push"
	@echo "================================================="

# ── Push the most recent tag + branch ────────────────────────
release-push: check-manifest
	@echo "Pushing branch $(BRANCH) + tag v$(VERSION) to origin..."
	git push origin $(BRANCH)
	git push origin v$(VERSION)
	@echo "Pushed."

# ── Publish to VS Marketplace (requires prior `tfx login`) ───
publish-marketplace: build
	@echo "Publishing v$(VERSION) to VS Marketplace..."
	./node_modules/.bin/tfx extension publish --manifest-globs vss-extension.json
	@echo "Published. Check https://marketplace.visualstudio.com/manage"

# ── Clean build output ───────────────────────────────────────
clean:
	rm -rf dist tests-build *.vsix
	@echo "Cleaned dist/, tests-build/, and stale .vsix artifacts."

# ── Print resolved version metadata ──────────────────────────
version: check-manifest
	@echo "Publisher : $(PUBLISHER)"
	@echo "Extension : $(EXT_ID)"
	@echo "Version   : $(VERSION)"
	@echo "Branch    : $(BRANCH)"
	@echo "VSIX      : $(VSIX)"

# ── Help ─────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  Currency Display Control — Makefile"
	@if [ -n "$(VERSION)" ]; then \
		echo "  Current: v$(VERSION) ($(PUBLISHER).$(EXT_ID))"; \
	fi
	@echo ""
	@echo "  Release flow:"
	@echo "    1. Bump 'version' in vss-extension.json"
	@echo "    2. make release MSG=\"what changed\""
	@echo "    3. Review locally"
	@echo "    4. make release-push"
	@echo "    5. make publish-marketplace   # if publishing to VS Marketplace"
	@echo ""
	@echo "  Targets:"
	@echo "    make install              install npm dependencies"
	@echo "    make typecheck            tsc --noEmit"
	@echo "    make test                 run formatter unit tests"
	@echo "    make build                clean + typecheck + webpack production bundle"
	@echo "    make audit                npm audit (high severity only)"
	@echo "    make package              build + produce .vsix in $(RELEASES)/"
	@echo "    make tag                  create local git tag v\$$(VERSION)"
	@echo "    make release              test + build + package + tag (no push)"
	@echo "    make release-push         push branch + tag to origin"
	@echo "    make publish-marketplace  publish .vsix to VS Marketplace"
	@echo "    make clean                remove dist/, tests-build/, stale .vsix"
	@echo "    make version              print resolved publisher / id / version / vsix"
	@echo ""