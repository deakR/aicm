package handlers

import (
	"bytes"
	"mime/multipart"
	"testing"
)

type testMultipartFile struct {
	*bytes.Reader
}

func (f *testMultipartFile) Close() error {
	return nil
}

func TestIsAllowedUploadExtension(t *testing.T) {
	if !isAllowedUploadExtension(".png") {
		t.Fatal("expected .png extension to be allowed")
	}

	if isAllowedUploadExtension(".exe") {
		t.Fatal("expected .exe extension to be rejected")
	}
}

func TestIsAllowedUploadMIME(t *testing.T) {
	if !isAllowedUploadMIME("image/jpeg") {
		t.Fatal("expected image/jpeg to be allowed")
	}

	if isAllowedUploadMIME("application/x-msdownload") {
		t.Fatal("expected application/x-msdownload to be rejected")
	}
}

func TestDetectUploadMIME(t *testing.T) {
	// PNG signature bytes.
	pngHeader := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 'A', 'A', 'A', 'A'}
	reader := &testMultipartFile{Reader: bytes.NewReader(pngHeader)}

	mimeType, err := detectUploadMIME(multipart.File(reader))
	if err != nil {
		t.Fatalf("expected no error detecting MIME, got %v", err)
	}

	if mimeType != "image/png" {
		t.Fatalf("expected image/png, got %q", mimeType)
	}
}
