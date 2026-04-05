package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type UploadHandler struct{}

type UploadResponse struct {
	URL  string `json:"url"`
	Name string `json:"name"`
	Type string `json:"type"`
}

const maxUploadBytes = 5 * 1024 * 1024

var allowedUploadExtensions = map[string]struct{}{
	".jpg":  {},
	".jpeg": {},
	".png":  {},
	".gif":  {},
	".webp": {},
	".pdf":  {},
	".txt":  {},
	".md":   {},
	".doc":  {},
	".docx": {},
}

var allowedUploadMIMETypes = map[string]struct{}{
	"image/jpeg":                {},
	"image/png":                 {},
	"image/gif":                 {},
	"image/webp":                {},
	"application/pdf":           {},
	"text/plain; charset=utf-8": {},
	"application/msword":        {},
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": {},
}

func generateRandomFilename(ext string) (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes) + ext, nil
}

func sanitizeUploadFilename(name string) string {
	base := strings.TrimSpace(filepath.Base(name))
	if base == "." || base == "/" || base == "\\" {
		return ""
	}
	return base
}

func isAllowedUploadExtension(ext string) bool {
	_, ok := allowedUploadExtensions[strings.ToLower(ext)]
	return ok
}

func isAllowedUploadMIME(mimeType string) bool {
	_, ok := allowedUploadMIMETypes[strings.ToLower(strings.TrimSpace(mimeType))]
	return ok
}

func detectUploadMIME(file multipart.File) (string, error) {
	buf := make([]byte, 512)
	n, err := file.Read(buf)
	if err != nil && err != io.EOF {
		return "", err
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", err
	}

	if n == 0 {
		return "", nil
	}

	return strings.ToLower(http.DetectContentType(buf[:n])), nil
}

func (h *UploadHandler) UploadFile(w http.ResponseWriter, r *http.Request) {
	// Keep body size bounded even before multipart parsing.
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes+1024)

	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		http.Error(w, "File too large or invalid format. Max 5MB.", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Error retrieving file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	if header.Size > maxUploadBytes {
		http.Error(w, "File exceeds 5MB limit", http.StatusBadRequest)
		return
	}

	originalName := sanitizeUploadFilename(header.Filename)
	if originalName == "" {
		http.Error(w, "Invalid filename", http.StatusBadRequest)
		return
	}

	ext := strings.ToLower(filepath.Ext(originalName))
	if !isAllowedUploadExtension(ext) {
		http.Error(w, "Unsupported file extension", http.StatusBadRequest)
		return
	}

	detectedType, err := detectUploadMIME(file)
	if err != nil {
		http.Error(w, "Failed to inspect uploaded file", http.StatusBadRequest)
		return
	}
	if !isAllowedUploadMIME(detectedType) {
		http.Error(w, "Unsupported file type", http.StatusBadRequest)
		return
	}

	uploadDir := filepath.Join(".", "uploads")
	if err := os.MkdirAll(uploadDir, 0o750); err != nil {
		http.Error(w, "Internal server error creating directory", http.StatusInternalServerError)
		return
	}

	newFilename, err := generateRandomFilename(ext)
	if err != nil {
		http.Error(w, "Internal server error generating filename", http.StatusInternalServerError)
		return
	}

	filePath := filepath.Join(uploadDir, newFilename)
	dst, err := os.OpenFile(filePath, os.O_CREATE|os.O_WRONLY|os.O_EXCL, 0o640)
	if err != nil {
		http.Error(w, "Failed to create file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	response := UploadResponse{
		URL:  fmt.Sprintf("/uploads/%s", newFilename),
		Name: originalName,
		Type: detectedType,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}
