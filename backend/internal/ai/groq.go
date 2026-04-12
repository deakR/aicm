package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

type Service struct {
	GroqAPIKey  string
	GroqBaseURL string
	HTTPClient  *http.Client
}

type groqChatRequest struct {
	Model          string              `json:"model"`
	Messages       []map[string]string `json:"messages"`
	Temperature    float32             `json:"temperature,omitempty"`
	ResponseFormat map[string]string   `json:"response_format,omitempty"`
}

type groqChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func defaultGroqModel() string {
	model := strings.TrimSpace(os.Getenv("GROQ_MODEL"))
	if model == "" {
		model = "llama-3.1-8b-instant"
	}
	return model
}

func (s *Service) groqChat(ctx context.Context, req groqChatRequest) (string, error) {
	if strings.TrimSpace(s.GroqAPIKey) == "" {
		return "", errors.New("groq api key is not configured")
	}

	body, err := json.Marshal(req)
	if err != nil {
		return "", err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, s.GroqBaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Authorization", "Bearer "+s.GroqAPIKey)
	httpReq.Header.Set("Content-Type", "application/json")

	httpRes, err := s.HTTPClient.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer httpRes.Body.Close()

	if httpRes.StatusCode < 200 || httpRes.StatusCode >= 300 {
		var errorBody struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		_ = json.NewDecoder(httpRes.Body).Decode(&errorBody)
		if errorBody.Error.Message != "" {
			return "", fmt.Errorf("groq request failed with status %d: %s", httpRes.StatusCode, errorBody.Error.Message)
		}
		return "", fmt.Errorf("groq request failed with status %d", httpRes.StatusCode)
	}

	var parsed groqChatResponse
	if err := json.NewDecoder(httpRes.Body).Decode(&parsed); err != nil {
		return "", err
	}

	if len(parsed.Choices) == 0 {
		return "", errors.New("groq returned no choices")
	}
	content := strings.TrimSpace(parsed.Choices[0].Message.Content)
	if content == "" {
		return "", errors.New("groq returned empty content")
	}
	return content, nil
}

// New initializes the Groq client used for generation and copilot tasks.
func New() *Service {
	svc := &Service{
		GroqAPIKey:  strings.TrimSpace(os.Getenv("GROQ_API_KEY")),
		GroqBaseURL: "https://api.groq.com/openai/v1",
		HTTPClient: &http.Client{
			Timeout: 45 * time.Second,
		},
	}
	if customBase := strings.TrimSpace(os.Getenv("GROQ_BASE_URL")); customBase != "" {
		svc.GroqBaseURL = customBase
	}

	if svc.GroqAPIKey == "" {
		log.Fatal("GROQ_API_KEY is not set")
	}

	fmt.Printf("Groq generation enabled with model %s\n", defaultGroqModel())
	return svc
}

func (s *Service) GenerateSupportReply(ctx context.Context, systemInstruction string, userMessage string) (string, error) {
	return s.groqChat(ctx, groqChatRequest{
		Model: defaultGroqModel(),
		Messages: []map[string]string{
			{"role": "system", "content": systemInstruction},
			{"role": "user", "content": userMessage},
		},
		Temperature: 0.2,
	})
}

func (s *Service) GenerateCopilotJSON(ctx context.Context, prompt string) (string, error) {
	return s.groqChat(ctx, groqChatRequest{
		Model: defaultGroqModel(),
		Messages: []map[string]string{
			{"role": "system", "content": "You are an AI support copilot. Return only valid JSON."},
			{"role": "user", "content": prompt},
		},
		Temperature:    0.2,
		ResponseFormat: map[string]string{"type": "json_object"},
	})
}

type groqEmbeddingRequest struct {
	Input string `json:"input"`
	Model string `json:"model"`
}

type groqEmbeddingResponse struct {
	Data []struct {
		Embedding []float32 `json:"embedding"`
	} `json:"data"`
}

func (s *Service) GenerateEmbedding(ctx context.Context, text string) ([]float32, error) {
	if strings.TrimSpace(s.GroqAPIKey) == "" {
		return nil, errors.New("groq api key is not configured")
	}

	reqBody := groqEmbeddingRequest{
		Input: text,
		Model: "nomic-embed-text-v1_5",
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, s.GroqBaseURL+"/embeddings", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+s.GroqAPIKey)
	httpReq.Header.Set("Content-Type", "application/json")

	httpRes, err := s.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer httpRes.Body.Close()

	if httpRes.StatusCode < 200 || httpRes.StatusCode >= 300 {
		return nil, fmt.Errorf("groq embeddings failed with status %d", httpRes.StatusCode)
	}

	var parsed groqEmbeddingResponse
	if err := json.NewDecoder(httpRes.Body).Decode(&parsed); err != nil {
		return nil, err
	}

	if len(parsed.Data) == 0 {
		return nil, errors.New("groq embeddings returned empty data")
	}

	return parsed.Data[0].Embedding, nil
}

// Close exists for interface parity with earlier versions of the service.
func (s *Service) Close() {}
