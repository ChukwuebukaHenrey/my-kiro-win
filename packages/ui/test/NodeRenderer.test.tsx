// Component tests for NodeRenderer (design C9, Requirements 12.4, 12.5).
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import type { ManifestNode } from '@dreame/schema';
import { NodeRenderer } from '../src/components/NodeRenderer.tsx';
import { createRenderRegistry, type RenderProps } from '../src/render.ts';
import { coreViews } from '../src/core-views.ts';

function ProbeView({ cfg, nodeState }: RenderProps<{ label: string }>): ReactNode {
  return (
    <div data-testid="probe">
      <span data-testid="probe-cfg">{cfg.label}</span>
      <span data-testid="probe-state">{JSON.stringify(nodeState ?? null)}</span>
    </div>
  );
}

const probeViews = createRenderRegistry([{ type: 'probe', Render: ProbeView }]);

describe('NodeRenderer', () => {
  it("renders a registered type's view with the node's config and nodeState", () => {
    const node: ManifestNode = { id: 'n1', type: 'probe', config: { label: 'Hello' }, edges: [] };
    render(
      <NodeRenderer node={node} nodeState={{ order: ['a', 'b'] }} views={probeViews} onRespond={() => {}} viewKey="n1#0" />,
    );
    expect(screen.getByTestId('probe-cfg').textContent).toBe('Hello');
    expect(screen.getByTestId('probe-state').textContent).toBe('{"order":["a","b"]}');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders a core view from coreViews', () => {
    const node: ManifestNode = { id: 'end', type: 'outcome', config: { title: 'All done', body: 'Thanks' }, edges: [] };
    render(<NodeRenderer node={node} nodeState={undefined} views={coreViews} onRespond={() => {}} viewKey="end#0" />);
    expect(screen.getByRole('heading', { level: 2, name: 'All done' })).toBeDefined();
  });

  it('shows an alert naming an unregistered type and no view', () => {
    const node: ManifestNode = { id: 'n1', type: '<b>quiz</b>', config: { label: 'Hello' }, edges: [] };
    const { container } = render(
      <NodeRenderer node={node} nodeState={undefined} views={probeViews} onRespond={() => {}} viewKey="n1#0" />,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('This activity has a step of type "<b>quiz</b>" that this app cannot show.');
    expect(alert.className).toBe('dr-error');
    expect(container.querySelector('b')).toBeNull();
    expect(screen.queryByTestId('probe')).toBeNull();
  });

  it('treats inherited object names as unregistered', () => {
    const node: ManifestNode = { id: 'n1', type: 'toString', config: {}, edges: [] };
    render(<NodeRenderer node={node} nodeState={undefined} views={coreViews} onRespond={() => {}} viewKey="n1#0" />);
    expect(screen.getByRole('alert').textContent).toContain('"toString"');
  });
});
