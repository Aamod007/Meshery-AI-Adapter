.PHONY: dev build test test-e2e lint docker clean

dev:
	@echo "Starting Go server and React dev server..."
	@cd web && npm run dev &
	@go run ./cmd/server

build:
	@echo "Building React app..."
	@cd web && npm run build
	@echo "Building Go binary..."
	@CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/server ./cmd/server

test:
	@go test -v ./internal/...

test-e2e:
	@go test -v ./tests/e2e/...

lint:
	@golangci-lint run
	@cd web && npm run lint

docker:
	@docker build -t llm-infra-assistant:dev -f deploy/Dockerfile .

clean:
	@rm -rf bin/ web/dist/
