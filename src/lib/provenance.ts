/**
 * This module contains various utilities for
 * creating, updating, and managing a nodelink graph.
 */
import { initProvenance, Provenance } from '@visdesignlab/trrack';
import { Node, State, Network } from '@/types';
import { highlightSelectedNodes, highlightLinks } from '@/components/NodeLink/functionUpdateVis';


export function setUpProvenance(network: Network): Provenance<State, any, any> {
  const initialState: State = {
    network,
    order: [],
    userSelectedEdges: [],
    selected: {},
    hardSelected: [],
    search: [],
    event: 'startedProvenance',
    nodeMarkerLength: 50,
    nodeMarkerHeight: 50,
  };

  const provenance =  initProvenance(initialState, false);

  provenance.addObserver(['selected'], function _func(state: State | undefined) {
    if (state) {
      // Update the UI
      highlightSelectedNodes(state);
      highlightLinks(state);
    } else {
      throw new Error('The state is not defined. Cannot highlight nodes.');
    }
  });


  return provenance;
}

// Check the state to see if the node is selected
export function isSelected(node: Node, currentState: State) {
  return Object.keys(currentState.selected).includes(node.id);
}

export function selectNode(node: Node, provenance: Provenance<State, any, any>): void {
  const action = provenance.addAction(
    'select node',
    (currentState: State) => {
      if (isSelected(node, currentState)) {
        delete currentState.selected[node.id];
      } else {
        currentState.selected[node.id] = node.neighbors;
      }
      return currentState;
    },
  );

  action
    .addEventType('selection')
    .alwaysStoreState(true)
    .applyAction();
}

export function redo(provenance: Provenance<State, any, any>): void {
  if (provenance.current().children.length > 0) {
    provenance.goForwardOneStep();
  }
}

export function undo(provenance: Provenance<State, any, any>): void {
  if ('parent' in provenance.current()) {
    provenance.goBackOneStep();
  }
}