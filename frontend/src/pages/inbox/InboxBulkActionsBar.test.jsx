import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InboxBulkActionsBar from './InboxBulkActionsBar';

describe('InboxBulkActionsBar', () => {
  const baseProps = {
    selectedCount: 2,
    isBulkActionLoading: false,
    onResolve: vi.fn(),
    onReopen: vi.fn(),
    onSnooze: vi.fn(),
    agents: [{ id: 'agent-1', name: 'Support Agent' }],
    bulkAssignAgentId: '',
    onBulkAssignAgentIdChange: vi.fn(),
    onApplyAssign: vi.fn(),
    onClear: vi.fn(),
  };

  it('renders nothing when there are no selected conversations', () => {
    const { container } = render(
      <InboxBulkActionsBar {...baseProps} selectedCount={0} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('triggers all bulk action callbacks', () => {
    const props = {
      ...baseProps,
      bulkAssignAgentId: 'agent-1',
      onResolve: vi.fn(),
      onReopen: vi.fn(),
      onSnooze: vi.fn(),
      onApplyAssign: vi.fn(),
      onClear: vi.fn(),
    };

    render(<InboxBulkActionsBar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Re-open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Snooze' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(props.onResolve).toHaveBeenCalledTimes(1);
    expect(props.onReopen).toHaveBeenCalledTimes(1);
    expect(props.onSnooze).toHaveBeenCalledTimes(1);
    expect(props.onApplyAssign).toHaveBeenCalledTimes(1);
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it('updates assignee selection', () => {
    const onBulkAssignAgentIdChange = vi.fn();

    render(
      <InboxBulkActionsBar
        {...baseProps}
        onBulkAssignAgentIdChange={onBulkAssignAgentIdChange}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('Assign to...'), {
      target: { value: 'agent-1' },
    });

    expect(onBulkAssignAgentIdChange).toHaveBeenCalledWith('agent-1');
  });
});
