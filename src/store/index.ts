import Vue from 'vue';
import Vuex, { Store } from 'vuex';
import { createDirectStore } from 'direct-vuex';
import {
  ForceCenter, ForceCollide, ForceLink, ForceManyBody, Simulation,
} from 'd3-force';

import {
  Link, Node, Network, NetworkMetadata, SimulationLink, State, LinkStyleVariables, LoadError, NestedVariables, ProvenanceEventTypes,
} from '@/types';
import { generateAPI } from '@/api';
import {
  GraphSpec, RowsSpec, TableMetadata, TableRow,
} from 'multinet';
import {
  scaleLinear, scaleOrdinal, scaleSequential,
} from 'd3-scale';
import { interpolateReds, schemeCategory10 } from 'd3-scale-chromatic';
import { initProvenance, Provenance } from '@visdesignlab/trrack';
import { undoRedoKeyHandler, updateProvenanceState } from '@/lib/provenanceUtils';

Vue.use(Vuex);

const {
  store,
  rootActionContext,
  moduleActionContext,
  rootGetterContext,
  moduleGetterContext,
} = createDirectStore({
  state: {
    workspaceName: null,
    networkName: null,
    network: null,
    networkMetadata: null,
    columnTypes: {},
    selectedNodes: new Set(),
    loadError: {
      message: '',
      buttonText: '',
      href: '',
    },
    simulation: null,
    displayCharts: false,
    markerSize: 50,
    fontSize: 12,
    labelVariable: '_key',
    selectNeighbors: true,
    nestedVariables: {
      bar: [],
      glyph: [],
    },
    linkVariables: {
      width: '',
      color: '',
    },
    nodeSizeVariable: '',
    nodeColorVariable: '',
    attributeRanges: {},
    nodeBarColorScale: scaleOrdinal(schemeCategory10),
    nodeGlyphColorScale: scaleOrdinal(schemeCategory10),
    linkWidthScale: scaleLinear().range([1, 20]),
    linkColorScale: scaleOrdinal(schemeCategory10),
    provenance: null,
    directionalEdges: false,
    controlsWidth: 256,
    simulationRunning: false,
    showProvenanceVis: false,
    rightClickMenu: {
      show: false,
      top: 0,
      left: 0,
    },
  } as State,

  getters: {
    workspaceName(state: State) {
      return state.workspaceName;
    },

    networkName(state: State) {
      return state.networkName;
    },

    network(state: State) {
      return state.network;
    },

    networkMetadata(state: State) {
      return state.networkMetadata;
    },

    columnTypes(state: State) {
      return state.columnTypes;
    },

    selectedNodes(state: State) {
      return state.selectedNodes;
    },

    loadError(state: State) {
      return state.loadError;
    },

    simulation(state: State) {
      return state.simulation;
    },

    displayCharts(state: State) {
      return state.displayCharts;
    },

    markerSize(state: State) {
      return state.markerSize;
    },

    fontSize(state: State) {
      return state.fontSize;
    },

    labelVariable(state: State) {
      return state.labelVariable;
    },

    nodeColorVariable(state: State) {
      return state.nodeColorVariable;
    },

    selectNeighbors(state: State) {
      return state.selectNeighbors;
    },

    nestedVariables(state: State) {
      return state.nestedVariables;
    },

    linkVariables(state: State) {
      return state.linkVariables;
    },

    nodeSizeVariable(state: State) {
      return state.nodeSizeVariable;
    },

    attributeRanges(state: State) {
      return state.attributeRanges;
    },

    nodeBarColorScale(state: State) {
      return state.nodeBarColorScale;
    },

    nodeGlyphColorScale(state: State) {
      return state.nodeBarColorScale;
    },

    linkWidthScale(state: State) {
      return state.linkWidthScale;
    },

    linkColorScale(state: State) {
      if (Object.keys(state.columnTypes).length > 0 && state.columnTypes[state.linkVariables.color] === 'number') {
        let minLinkValue = 0;
        let maxLinkValue = 1;

        if (state.network !== null) {
          const values = state.network.edges.map((link) => link[state.linkVariables.color]);
          minLinkValue = Math.min(...values);
          maxLinkValue = Math.max(...values);
        }

        return scaleSequential(interpolateReds)
          .domain([minLinkValue, maxLinkValue]);
      }

      return scaleOrdinal(schemeCategory10);
    },

    directionalEdges(state: State) {
      return state.directionalEdges;
    },

    controlsWidth(state: State) {
      return state.controlsWidth;
    },

    provenance(state: State) {
      return state.provenance;
    },

    simulationRunning(state: State) {
      return state.simulationRunning;
    },

    showProvenanceVis(state: State) {
      return state.showProvenanceVis;
    },

    rightClickMenu(state: State) {
      return state.rightClickMenu;
    },
  },
  mutations: {
    setWorkspaceName(state, workspaceName: string) {
      state.workspaceName = workspaceName;
    },

    setNetworkName(state, networkName: string) {
      state.networkName = networkName;
    },

    setNetwork(state, network: Network) {
      state.network = network;
    },

    setNetworkMetadata(state, networkMetadata: NetworkMetadata) {
      state.networkMetadata = networkMetadata;
    },

    setColumnTypes(state, networkMetadata: NetworkMetadata) {
      const typeMapping: { [key: string]: string } = {};

      if (networkMetadata !== null) {
        Object.values(networkMetadata).forEach((metadata) => {
          (metadata as TableMetadata).table.columns.forEach((columnType) => {
            typeMapping[columnType.key] = columnType.type;
          });
        });
      }

      state.columnTypes = typeMapping;
    },

    setSelected(state, selectedNodes: Set<string>) {
      state.selectedNodes = selectedNodes;

      if (state.provenance !== null) {
        if (selectedNodes.size === 0) {
          updateProvenanceState(state, 'Clear Selection');
        }
      }
    },

    setLoadError(state, loadError: LoadError) {
      state.loadError = {
        message: loadError.message,
        buttonText: loadError.buttonText,
        href: loadError.href,
      };
    },

    setSimulation(state, simulation: Simulation<Node, SimulationLink>) {
      state.simulation = simulation;
    },

    startSimulation(state) {
      if (state.simulation !== null) {
        state.simulation.alpha(0.2);
        state.simulation.restart();
        state.simulationRunning = true;
      }
    },

    stopSimulation(state) {
      if (state.simulation !== null) {
        state.simulation.stop();
        state.simulationRunning = false;
      }
    },

    addSelectedNode(state, nodesToAdd: string[]) {
      state.selectedNodes = new Set([...state.selectedNodes, ...nodesToAdd]);

      if (state.provenance !== null) {
        updateProvenanceState(state, 'Select Node(s)');
      }
    },

    removeSelectedNode(state, nodeID: string) {
      state.selectedNodes.delete(nodeID);
      state.selectedNodes = new Set(state.selectedNodes);

      if (state.provenance !== null) {
        updateProvenanceState(state, 'De-select Node');
      }
    },

    setDisplayCharts(state, displayCharts: boolean) {
      state.displayCharts = displayCharts;

      if (state.provenance !== null) {
        updateProvenanceState(state, 'Set Display Charts');
      }
    },

    setMarkerSize(state, payload: { markerSize: number; updateProv: boolean }) {
      state.markerSize = payload.markerSize;

      if (state.provenance !== null && payload.updateProv) {
        updateProvenanceState(state, 'Set Marker Size');
      }
    },

    setFontSize(state, payload: { fontSize: number; updateProv: boolean }) {
      state.fontSize = payload.fontSize;

      if (state.provenance !== null && payload.updateProv) {
        updateProvenanceState(state, 'Set Font Size');
      }
    },

    setLabelVariable(state, labelVariable: string) {
      state.labelVariable = labelVariable;

      if (state.provenance !== null) {
        updateProvenanceState(state, 'Set Label Variable');
      }
    },

    setNodeColorVariable(state, nodeColorVariable: string) {
      state.nodeColorVariable = nodeColorVariable;

      if (state.provenance !== null) {
        updateProvenanceState(state, 'Set Node Color Variable');
      }
    },

    setSelectNeighbors(state, selectNeighbors: boolean) {
      state.selectNeighbors = selectNeighbors;

      if (state.provenance !== null) {
        updateProvenanceState(state, 'Set Select Neighbors');
      }
    },

    setNestedVariables(state, nestedVariables: NestedVariables) {
      const newNestedVars = {
        ...nestedVariables,
        bar: [...new Set(nestedVariables.bar)],
        glyph: [...new Set(nestedVariables.glyph)],
      };

      // Allow only 2 variables for the glyphs
      newNestedVars.glyph.length = Math.min(2, newNestedVars.glyph.length);

      state.nestedVariables = newNestedVars;
    },

    setLinkVariables(state, linkVariables: LinkStyleVariables) {
      state.linkVariables = linkVariables;
    },

    setNodeSizeVariable(state, nodeSizeVariable: string) {
      state.nodeSizeVariable = nodeSizeVariable;

      if (state.provenance !== null) {
        updateProvenanceState(state, 'Set Node Size Variable');
      }
    },

    addAttributeRange(state, attributeRange: { attr: string; min: number; max: number; binLabels: string[]; binValues: number[] }) {
      state.attributeRanges = { ...state.attributeRanges, [attributeRange.attr]: attributeRange };
    },

    updateLinkWidthDomain(state, domain: number[]) {
      if (domain.length === 2) {
        state.linkWidthScale.domain(domain).range([1, 20]);
      }
    },

    setProvenance(state, provenance: Provenance<State, ProvenanceEventTypes, unknown>) {
      state.provenance = provenance;
    },

    setDirectionalEdges(state, directionalEdges: boolean) {
      state.directionalEdges = directionalEdges;

      if (state.provenance !== null) {
        updateProvenanceState(state, 'Set Directional Edges');
      }
    },

    goToProvenanceNode(state, node: string) {
      if (state.provenance !== null) {
        state.provenance.goToNode(node);
      }
    },

    toggleShowProvenanceVis(state: State) {
      state.showProvenanceVis = !state.showProvenanceVis;
    },

    updateRightClickMenu(state: State, payload: { show: boolean; top: number; left: number }) {
      state.rightClickMenu = payload;
    },
  },
  actions: {
    async fetchNetwork(context, payload: { workspaceName: string; networkName: string; host: string }) {
      const { commit } = rootActionContext(context);
      const { workspaceName, networkName, host } = payload;

      commit.setWorkspaceName(workspaceName);
      commit.setNetworkName(networkName);

      const api = generateAPI(host);

      let networkTables: GraphSpec | undefined;

      // Get all table names
      try {
        networkTables = await api.graph(workspaceName, networkName);
      } catch (error) {
        if (error.status === 404) {
          commit.setLoadError({
            message: error.statusText,
            buttonText: 'Back to MultiNet',
            href: 'https://multinet.app',
          });
        } else {
          commit.setLoadError({
            message: 'An unexpected error ocurred',
            buttonText: 'Back to MultiNet',
            href: 'https://multinet.app',
          });
        }
      } finally {
        if (store.getters.loadError.message === '' && typeof networkTables === 'undefined') {
          // Catches CORS errors, issues when DB/API are down, etc.
          commit.setLoadError({
            message: 'There was a network issue when getting data',
            buttonText: 'Refresh the page',
            href: `./?workspace=${workspaceName}&graph=${networkName}`,
          });
        }
      }

      if (networkTables === undefined) {
        return;
      }

      // Generate all node table promises
      const nodePromises: Promise<RowsSpec>[] = [];
      networkTables.nodeTables.forEach((table) => {
        nodePromises.push(api.table(workspaceName, table, { offset: 0, limit: 1000 }));
      });

      // Resolve all node table promises and extract the rows
      const resolvedNodePromises = await Promise.all(nodePromises);
      const nodes: TableRow[] = [];
      resolvedNodePromises.forEach((resolvedPromise) => {
        nodes.push(...resolvedPromise.rows);
      });

      // Generate and resolve edge table promise and extract rows
      const edgePromise = await api.table(workspaceName, networkTables.edgeTable, { offset: 0, limit: 1000 });
      const edges = edgePromise.rows;

      // Build the network object and set it as the network in the store
      const network = {
        nodes: nodes as Node[],
        edges: edges as Link[],
      };
      commit.setNetwork(network);

      // Get the network metadata promises
      const metadataPromises: Promise<TableMetadata>[] = [];
      networkTables.nodeTables.forEach((table) => {
        metadataPromises.push(api.tableMetadata(workspaceName, table));
      });
      metadataPromises.push(api.tableMetadata(workspaceName, networkTables.edgeTable));

      // Resolve network metadata promises
      const resolvedMetadataPromises = await Promise.all(metadataPromises);

      // Combine all network metadata
      const networkMetadata: NetworkMetadata = {};
      resolvedMetadataPromises.forEach((metadata) => {
        const tableName = metadata.item_id;
        networkMetadata[tableName] = metadata;
      });

      commit.setNetworkMetadata(networkMetadata);
      commit.setColumnTypes(networkMetadata);
    },

    releaseNodes(context) {
      const { commit } = rootActionContext(context);

      if (context.state.network !== null) {
        context.state.network.nodes.forEach((n: Node) => {
          // eslint-disable-next-line no-param-reassign
          n.fx = null;
          // eslint-disable-next-line no-param-reassign
          n.fy = null;
        });
        commit.startSimulation();
      }
    },

    createProvenance(context) {
      const { commit } = rootActionContext(context);

      const storeState = context.state;

      const stateForProv = JSON.parse(JSON.stringify(context.state));
      stateForProv.selectedNodes = [];

      commit.setProvenance(initProvenance<State, ProvenanceEventTypes, unknown>(
        stateForProv,
        { loadFromUrl: false },
      ));

      // Add a global observer to watch the state and update the tracked elements in the store
      // enables undo/redo + navigating around provenance graph
      storeState.provenance.addGlobalObserver(
        () => {
          const provenanceState = context.state.provenance.state;

          // TODO: #148 remove cast back to set
          const selectedNodes = new Set<string>(provenanceState.selectedNodes);

          // Helper function
          const setsAreEqual = (a: Set<unknown>, b: Set<unknown>) => a.size === b.size && [...a].every((value) => b.has(value));

          // If the sets are not equal (happens when provenance is updated through provenance vis),
          // update the store's selectedNodes to match the provenance state
          if (!setsAreEqual(selectedNodes, storeState.selectedNodes)) {
            storeState.selectedNodes = selectedNodes;
          }

          // Iterate through vars with primitive data types
          [
            'displayCharts',
            'markerSize',
            'fontSize',
            'labelVariable',
            'nodeSizeVariable',
            'nodeColorVariable',
            'selectNeighbors',
            'directionalEdges',
          ].forEach((primitiveVariable) => {
            if (storeState[primitiveVariable] !== provenanceState[primitiveVariable]) {
              storeState[primitiveVariable] = provenanceState[primitiveVariable];
            }
          });
        },
      );

      storeState.provenance.done();

      // Add keydown listener for undo/redo
      document.addEventListener('keydown', (event) => undoRedoKeyHandler(event, storeState));
    },

    updateSimulationForce(context, payload: {
      forceType: 'center' | 'charge' | 'link' | 'collision';
      forceValue: ForceCenter<Node> | ForceManyBody<Node> | ForceLink<Node, SimulationLink> | ForceCollide<Node>;
      restart: boolean;
    }) {
      const { commit } = rootActionContext(context);
      if (context.state.simulation !== null) {
        const { forceType, forceValue, restart } = payload;
        context.state.simulation.force(forceType, forceValue);

        if (restart) {
          commit.startSimulation();
        }
      }
    },
  },
});

export default store;
export {
  rootActionContext,
  moduleActionContext,
  rootGetterContext,
  moduleGetterContext,
};

// The following lines enable types in the injected store '$store'.
export type ApplicationStore = typeof store;
declare module 'vuex' {
  interface Store<S> {
    direct: ApplicationStore;
  }
}
