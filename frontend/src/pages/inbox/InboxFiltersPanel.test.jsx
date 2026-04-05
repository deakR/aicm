import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InboxFiltersPanel from './InboxFiltersPanel';

describe('InboxFiltersPanel', () => {
  const emptyFilters = {
    status: '',
    assignee_id: '',
    days: '',
    source: '',
    tag: '',
  };

  const baseProps = {
    filterSummary: 'All conversations',
    showFilters: true,
    onToggleFilters: vi.fn(),
    activeFilterCount: 1,
    filters: emptyFilters,
    setFilters: vi.fn(),
    agents: [{ id: 'agent-1', name: 'Support Agent' }],
    availableTags: ['billing', 'technical'],
    onClearFilters: vi.fn(),
    onToggleSelectAll: vi.fn(),
    allSelected: false,
    hasConversations: true,
  };

  it('shows filter summary and toggles filter panel', () => {
    const onToggleFilters = vi.fn();
    render(
      <InboxFiltersPanel
        {...baseProps}
        showFilters={false}
        onToggleFilters={onToggleFilters}
      />,
    );

    expect(screen.getByText('All conversations')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit (1)' }));
    expect(onToggleFilters).toHaveBeenCalledTimes(1);
  });

  it('applies status updates through setFilters updater', () => {
    const setFilters = vi.fn();
    render(<InboxFiltersPanel {...baseProps} setFilters={setFilters} />);

    fireEvent.change(screen.getByDisplayValue('All conversations'), {
      target: { value: 'open' },
    });

    const updater = setFilters.mock.calls[0][0];
    expect(typeof updater).toBe('function');
    expect(updater(emptyFilters)).toEqual({
      ...emptyFilters,
      status: 'open',
    });
  });

  it('supports quick tag selection and utility actions', () => {
    const setFilters = vi.fn();
    const onClearFilters = vi.fn();
    const onToggleSelectAll = vi.fn();

    render(
      <InboxFiltersPanel
        {...baseProps}
        setFilters={setFilters}
        onClearFilters={onClearFilters}
        onToggleSelectAll={onToggleSelectAll}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'billing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));

    const updater = setFilters.mock.calls[0][0];
    expect(updater(emptyFilters)).toEqual({
      ...emptyFilters,
      tag: 'billing',
    });
    expect(onClearFilters).toHaveBeenCalledTimes(1);
    expect(onToggleSelectAll).toHaveBeenCalledTimes(1);
  });
});
