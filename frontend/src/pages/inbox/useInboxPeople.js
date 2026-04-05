import { useEffect, useMemo, useState } from "react";

export default function useInboxPeople({ apiUrl, token }) {
  const [people, setPeople] = useState({
    agents: [],
    customers: [],
  });

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let cancelled = false;

    const fetchPeople = async () => {
      try {
        const [agentsRes, customersRes] = await Promise.all([
          fetch(`${apiUrl}/api/protected/users?role=agent`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiUrl}/api/protected/users?role=customer`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!cancelled) {
          setPeople({
            agents: agentsRes.ok ? await agentsRes.json() : [],
            customers: customersRes.ok ? await customersRes.json() : [],
          });
        }
      } catch (err) {
        console.error("Failed to fetch support users", err);
      }
    };

    fetchPeople();

    return () => {
      cancelled = true;
    };
  }, [apiUrl, token]);

  const value = useMemo(
    () => (token ? people : { agents: [], customers: [] }),
    [people, token],
  );

  return {
    agents: value.agents,
    customers: value.customers,
  };
}
