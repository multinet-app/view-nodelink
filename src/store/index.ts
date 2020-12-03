import Vue from 'vue';
import Vuex, { Store } from 'vuex';
import { createDirectStore } from 'direct-vuex';
import { Simulation } from 'd3-force';

import {
  Link, Node, Network, SimulationLink,
} from '@/types';
import api from '@/api';
import { GraphSpec, RowsSpec, TableRow } from 'multinet';
import {
  scaleLinear, ScaleLinear, scaleOrdinal, ScaleOrdinal,
} from 'd3-scale';
import { schemeCategory10 } from 'd3-scale-chromatic';

Vue.use(Vuex);

interface LoadError {
  message: string;
  buttonText: string;
  href: string;
}

interface NestedVariables {
  bar: string[];
  glyph: string[];
}

interface LinkStyleVariables {
  width: string;
  color: string;
}

interface AttributeRanges {
  [key: string]: {attr: string; min: number; max: number};
}

export interface State {
  workspaceName: string | null;
  networkName: string | null;
  network: Network | null;
  selectedNodes: Set<string>;
  loadError: LoadError;
  simulation: Simulation<Node, SimulationLink> | null;
  renderNested: boolean;
  markerSize: number;
  fontSize: number;
  labelVariable: string;
  colorVariable: string;
  selectNeighbors: boolean;
  nestedVariables: NestedVariables;
  linkVariables: LinkStyleVariables;
  attributeRanges: AttributeRanges;
  nodeColorScale: ScaleOrdinal<string, string>;
  linkWidthScale: ScaleLinear<number, number>;
}

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
    selectedNodes: new Set(),
    loadError: {
      message: '',
      buttonText: '',
      href: '',
    },
    simulation: null,
    renderNested: false,
    markerSize: 50,
    fontSize: 12,
    labelVariable: '_key',
    colorVariable: '_key',
    selectNeighbors: true,
    nestedVariables: {
      bar: [],
      glyph: [],
    },
    linkVariables: {
      width: '',
      color: '',
    },
    attributeRanges: {},
    nodeColorScale: scaleOrdinal(schemeCategory10),
    linkWidthScale: scaleLinear().range([1, 20]),
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

    selectedNodes(state: State) {
      return state.selectedNodes;
    },

    loadError(state: State) {
      return state.loadError;
    },

    simulation(state: State) {
      return state.simulation;
    },

    renderNested(state: State) {
      return state.renderNested;
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

    colorVariable(state: State) {
      return state.colorVariable;
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

    attributeRanges(state: State) {
      return state.attributeRanges;
    },

    nodeColorScale(state: State) {
      return state.nodeColorScale;
    },

    linkWidthScale(state: State) {
      return state.linkWidthScale;
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

    setSelected(state, selectedNodes: Set<string>) {
      state.selectedNodes = selectedNodes;
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
        state.simulation.alpha(0.5);
        state.simulation.restart();
      }
    },

    stopSimulation(state) {
      if (state.simulation !== null) {
        state.simulation.stop();
      }
    },

    addSelectedNode(state, nodeID: string) {
      state.selectedNodes = new Set(state.selectedNodes.add(nodeID));
    },

    removeSelectedNode(state, nodeID: string) {
      state.selectedNodes.delete(nodeID);
      state.selectedNodes = new Set(state.selectedNodes);
    },

    setRenderNested(state, renderNested: boolean) {
      state.renderNested = renderNested;
    },

    setMarkerSize(state, markerSize: number) {
      state.markerSize = markerSize;
    },

    setFontSize(state, fontSize: number) {
      state.fontSize = fontSize;
    },

    setLabelVariable(state, labelVariable: string) {
      state.labelVariable = labelVariable;
    },

    setColorVariable(state, colorVariable: string) {
      state.colorVariable = colorVariable;
    },

    setSelectNeighbors(state, selectNeighbors: boolean) {
      state.selectNeighbors = selectNeighbors;
    },

    setNestedVariables(state, nestedVariables: NestedVariables) {
      // Remove duplicates from the nested variables
      nestedVariables.bar = [...new Set(nestedVariables.bar)];
      nestedVariables.glyph = [...new Set(nestedVariables.glyph)];

      // Allow only 2 variables for the glyphs
      nestedVariables.glyph.length = nestedVariables.glyph.length > 2 ? 2 : nestedVariables.glyph.length;

      state.nestedVariables = nestedVariables;
    },

    setLinkVariables(state, linkVariables: LinkStyleVariables) {
      state.linkVariables = linkVariables;
    },

    addAttributeRange(state, attributeRange: { attr: string; min: number; max: number }) {
      state.attributeRanges = { ...state.attributeRanges, [attributeRange.attr]: attributeRange };
    },

    updateLinkWidthDomain(state, domain: number[]) {
      if (domain.length === 2) {
        state.linkWidthScale.domain(domain).range([1, 20]);
      }
    },
  },
  actions: {
    async fetchNetwork(context, { workspaceName, networkName }) {
      const { commit } = rootActionContext(context);
      commit.setWorkspaceName(workspaceName);
      commit.setNetworkName(networkName);

      let networkTables: GraphSpec | undefined;

      // Get all table names
      try {
        networkTables = await api.graph(workspaceName, networkName);
      } catch (error) {
        if (error.status === 404) {
          commit.setLoadError({
            message: error.statusText,
            buttonText: 'Back to MultiNet',
            href: '/',
          });
        }

        commit.setLoadError({
          message: 'An unexpected error ocurred',
          buttonText: 'Back to MultiNet',
          href: '/',
        });
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
    },

    releaseNodes(context) {
      const { commit } = rootActionContext(context);

      if (context.state.network !== null) {
        context.state.network.nodes.forEach((n: Node) => {
          n.fx = null;
          n.fy = null;
        });
        commit.startSimulation();
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
