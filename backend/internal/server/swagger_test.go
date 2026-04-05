package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestOpenAPISpecContainsCoreSections(t *testing.T) {
	spec := openAPISpec()

	if spec["openapi"] != "3.0.3" {
		t.Fatalf("expected openapi version 3.0.3, got %v", spec["openapi"])
	}

	info, ok := spec["info"].(map[string]interface{})
	if !ok {
		t.Fatal("expected info object in openapi spec")
	}
	if info["title"] == "" {
		t.Fatal("expected non-empty API title")
	}

	components, ok := spec["components"].(map[string]interface{})
	if !ok {
		t.Fatal("expected components object in openapi spec")
	}
	if _, ok := components["schemas"].(map[string]interface{}); !ok {
		t.Fatal("expected schemas object in components")
	}

	paths, ok := spec["paths"].(map[string]interface{})
	if !ok {
		t.Fatal("expected paths object in openapi spec")
	}

	required := []string{
		"/api/health",
		"/api/auth/login",
		"/api/protected/conversations",
		"/api/protected/analytics",
		"/api/protected/settings/ai",
	}
	for _, path := range required {
		if _, exists := paths[path]; !exists {
			t.Fatalf("expected required path %q in openapi spec", path)
		}
	}
}

func TestSwaggerHelperBuilders(t *testing.T) {
	if got := schemaRef("Ticket"); got["$ref"] != "#/components/schemas/Ticket" {
		t.Fatalf("unexpected schemaRef output: %v", got)
	}

	security := bearerSecurity()
	if len(security) != 1 || len(security[0]["BearerAuth"]) != 0 {
		t.Fatalf("unexpected bearerSecurity output: %#v", security)
	}

	jsonRes := jsonResponse("ok", map[string]interface{}{"type": "string"})
	if jsonRes["description"] != "ok" {
		t.Fatalf("unexpected jsonResponse description: %v", jsonRes["description"])
	}

	textRes := textResponse("plain")
	if textRes["description"] != "plain" {
		t.Fatalf("unexpected textResponse description: %v", textRes["description"])
	}

	body := jsonRequestBody(map[string]interface{}{"type": "object"}, true, map[string]interface{}{"ok": true})
	if body["required"] != true {
		t.Fatalf("expected request body required=true, got %v", body["required"])
	}

	path := pathParam("id", "Record ID")
	if path["in"] != "path" || path["name"] != "id" {
		t.Fatalf("unexpected pathParam output: %v", path)
	}

	query := queryParam("days", "N days", "integer", 7)
	if query["in"] != "query" || query["name"] != "days" {
		t.Fatalf("unexpected queryParam output: %v", query)
	}
}

func TestSwaggerExplorerHTMLContainsExpectedMarkers(t *testing.T) {
	html := swaggerExplorerHTML()

	if !strings.Contains(html, "AICM API Explorer") {
		t.Fatal("expected explorer title in html output")
	}
	if !strings.Contains(html, "/swagger/openapi.json") {
		t.Fatal("expected openapi endpoint reference in html output")
	}
	if !strings.Contains(html, "Bearer Token") {
		t.Fatal("expected auth control marker in html output")
	}
}

func TestRegisterDocsRoutesServesSwaggerAssets(t *testing.T) {
	s := &Server{Router: chi.NewRouter()}
	s.registerDocsRoutes()

	htmlReq := httptest.NewRequest(http.MethodGet, "/swagger", nil)
	htmlRec := httptest.NewRecorder()
	s.Router.ServeHTTP(htmlRec, htmlReq)

	if htmlRec.Code != http.StatusOK {
		t.Fatalf("expected /swagger status 200, got %d", htmlRec.Code)
	}
	if !strings.Contains(htmlRec.Header().Get("Content-Type"), "text/html") {
		t.Fatalf("expected text/html content type, got %q", htmlRec.Header().Get("Content-Type"))
	}
	if !strings.Contains(htmlRec.Body.String(), "AICM API Explorer") {
		t.Fatal("expected explorer html content")
	}

	jsonReq := httptest.NewRequest(http.MethodGet, "/swagger/openapi.json", nil)
	jsonRec := httptest.NewRecorder()
	s.Router.ServeHTTP(jsonRec, jsonReq)

	if jsonRec.Code != http.StatusOK {
		t.Fatalf("expected /swagger/openapi.json status 200, got %d", jsonRec.Code)
	}
	if !strings.Contains(jsonRec.Header().Get("Content-Type"), "application/json") {
		t.Fatalf("expected application/json content type, got %q", jsonRec.Header().Get("Content-Type"))
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(jsonRec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("expected valid openapi json response, got error: %v", err)
	}
	if _, ok := payload["paths"].(map[string]interface{}); !ok {
		t.Fatal("expected openapi payload to include paths")
	}
}
