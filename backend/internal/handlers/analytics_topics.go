package handlers

import (
	"sort"
	"strings"
	"unicode"
)

type analyticsCluster struct {
	count      int
	tokenSet   map[string]struct{}
	tokenCount map[string]int
}

var analyticsStopWords = map[string]struct{}{
	"a": {}, "an": {}, "and": {}, "are": {}, "as": {}, "at": {}, "be": {}, "but": {},
	"by": {}, "can": {}, "do": {}, "for": {}, "from": {}, "get": {}, "got": {},
	"have": {}, "help": {}, "hey": {}, "hi": {}, "how": {}, "i": {}, "if": {},
	"in": {}, "is": {}, "it": {}, "just": {}, "me": {}, "my": {}, "need": {},
	"not": {}, "of": {}, "on": {}, "or": {}, "our": {}, "please": {}, "so": {},
	"still": {}, "that": {}, "the": {}, "their": {}, "them": {}, "there": {},
	"this": {}, "to": {}, "up": {}, "was": {}, "we": {}, "with": {}, "you": {},
	"your": {},
}

var analyticsAliases = map[string]string{
	"billing": "bill", "billed": "bill", "charges": "charge", "charged": "charge",
	"deliveries": "delivery", "delivered": "delivery", "shipping": "ship", "shipped": "ship",
	"tracking": "track", "tracked": "track", "invoices": "invoice",
	"payments": "payment", "passwords": "password", "resets": "reset",
	"subscriptions": "subscription", "plans": "plan", "refunds": "refund",
	"returned": "return", "returns": "return", "cancelled": "cancel", "cancellations": "cancel",
	"emails": "email", "logins": "login", "accounts": "account", "orders": "order",
}

var analyticsLabelRules = []struct {
	label  string
	tokens []string
}{
	{label: "Billing & Payments", tokens: []string{"bill", "charge", "invoice", "payment", "refund", "transaction"}},
	{label: "Shipping & Delivery", tokens: []string{"ship", "delivery", "track", "order", "package", "courier"}},
	{label: "Account & Access", tokens: []string{"account", "login", "password", "reset", "email", "access"}},
	{label: "Subscriptions & Plans", tokens: []string{"subscription", "plan", "upgrade", "downgrade", "trial", "price"}},
	{label: "Cancellations", tokens: []string{"cancel", "close", "terminate", "delete", "remove"}},
	{label: "Product Issues", tokens: []string{"error", "issue", "problem", "broken", "failed", "crash"}},
}

func normalizeAnalyticsToken(token string) string {
	token = strings.ToLower(strings.TrimSpace(token))
	if alias, ok := analyticsAliases[token]; ok {
		return alias
	}
	if len(token) > 4 && strings.HasSuffix(token, "ing") {
		token = strings.TrimSuffix(token, "ing")
	}
	if len(token) > 3 && strings.HasSuffix(token, "ed") {
		token = strings.TrimSuffix(token, "ed")
	}
	if len(token) > 4 && strings.HasSuffix(token, "es") {
		token = strings.TrimSuffix(token, "es")
	}
	if len(token) > 3 && strings.HasSuffix(token, "s") {
		token = strings.TrimSuffix(token, "s")
	}
	if alias, ok := analyticsAliases[token]; ok {
		return alias
	}
	return token
}

func tokenizeAnalyticsText(text string) []string {
	parts := strings.FieldsFunc(strings.ToLower(text), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})
	seen := map[string]struct{}{}
	tokens := make([]string, 0, len(parts))
	for _, part := range parts {
		token := normalizeAnalyticsToken(part)
		if len(token) < 3 {
			continue
		}
		if _, stop := analyticsStopWords[token]; stop {
			continue
		}
		if _, exists := seen[token]; exists {
			continue
		}
		seen[token] = struct{}{}
		tokens = append(tokens, token)
	}
	sort.Strings(tokens)
	return tokens
}

func tokenSliceToSet(tokens []string) map[string]struct{} {
	set := make(map[string]struct{}, len(tokens))
	for _, token := range tokens {
		set[token] = struct{}{}
	}
	return set
}

func tokenOverlap(a, b map[string]struct{}) int {
	count := 0
	for token := range a {
		if _, ok := b[token]; ok {
			count++
		}
	}
	return count
}

func labelAnalyticsCluster(tokenCount map[string]int) string {
	bestLabel := ""
	bestScore := 0
	for _, rule := range analyticsLabelRules {
		score := 0
		for _, token := range rule.tokens {
			score += tokenCount[token]
		}
		if score > bestScore {
			bestScore = score
			bestLabel = rule.label
		}
	}
	if bestScore > 0 {
		return bestLabel
	}

	type tokenEntry struct {
		token string
		count int
	}
	entries := make([]tokenEntry, 0, len(tokenCount))
	for token, count := range tokenCount {
		entries = append(entries, tokenEntry{token: token, count: count})
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].count == entries[j].count {
			return entries[i].token < entries[j].token
		}
		return entries[i].count > entries[j].count
	})
	if len(entries) == 0 {
		return "Other Support Topics"
	}
	if len(entries) == 1 {
		return strings.Title(entries[0].token)
	}
	return strings.Title(entries[0].token) + " & " + strings.Title(entries[1].token)
}

func isPredefinedAnalyticsLabel(label string) bool {
	for _, rule := range analyticsLabelRules {
		if rule.label == label {
			return true
		}
	}
	return false
}

func clusterTopicsFromTexts(texts []string, limit int) []topicStat {
	clusters := []analyticsCluster{}

	for _, text := range texts {
		tokens := tokenizeAnalyticsText(text)
		if len(tokens) == 0 {
			continue
		}

		set := tokenSliceToSet(tokens)
		bestIndex := -1
		bestScore := 0
		for i, cluster := range clusters {
			score := tokenOverlap(set, cluster.tokenSet)
			if score > bestScore && (score >= 2 || float64(score) >= float64(len(set))/2) {
				bestIndex = i
				bestScore = score
			}
		}

		if bestIndex == -1 {
			tokenCount := map[string]int{}
			for _, token := range tokens {
				tokenCount[token]++
			}
			clusters = append(clusters, analyticsCluster{
				count:      1,
				tokenSet:   set,
				tokenCount: tokenCount,
			})
			continue
		}

		cluster := &clusters[bestIndex]
		cluster.count++
		for _, token := range tokens {
			cluster.tokenSet[token] = struct{}{}
			cluster.tokenCount[token]++
		}
	}

	grouped := map[string]int{}
	for _, cluster := range clusters {
		label := labelAnalyticsCluster(cluster.tokenCount)
		if !isPredefinedAnalyticsLabel(label) && cluster.count < 2 {
			grouped["Other Support Topics"] += cluster.count
			continue
		}
		grouped[label] += cluster.count
	}

	topics := make([]topicStat, 0, len(grouped))
	for label, count := range grouped {
		topics = append(topics, topicStat{Topic: label, Count: count})
	}

	sort.Slice(topics, func(i, j int) bool {
		if topics[i].Count == topics[j].Count {
			return topics[i].Topic < topics[j].Topic
		}
		return topics[i].Count > topics[j].Count
	})
	if limit > 0 && len(topics) > limit {
		topics = topics[:limit]
	}
	return topics
}
