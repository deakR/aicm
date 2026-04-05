package handlers

import "testing"

func TestBuildTicketStatusNotification(t *testing.T) {
	tests := []struct {
		status string
		want   string
	}{
		{status: "in_progress", want: `Your ticket "Billing issue" is now in progress.`},
		{status: "resolved", want: `Your ticket "Billing issue" has been marked resolved.`},
		{status: "closed", want: `Your ticket "Billing issue" has been closed.`},
		{status: "open", want: `Your ticket "Billing issue" is now open.`},
	}

	for _, tc := range tests {
		got := buildTicketStatusNotification("Billing issue", tc.status)
		if got != tc.want {
			t.Fatalf("status %q: got %q want %q", tc.status, got, tc.want)
		}
	}
}
