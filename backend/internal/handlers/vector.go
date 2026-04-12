package handlers

import (
	"strconv"
	"strings"
)

func vectorLiteral(values []float32) *string {
	if len(values) == 0 {
		return nil
	}

	parts := make([]string, len(values))
	for i, value := range values {
		parts[i] = strconv.FormatFloat(float64(value), 'f', -1, 32)
	}

	literal := "[" + strings.Join(parts, ",") + "]"
	return &literal
}
