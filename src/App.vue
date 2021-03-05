<script lang="ts">
import store from '@/store';
import { getUrlVars } from '@/lib/utils';
import {
  ref, computed, Ref,
} from '@vue/composition-api';

import Controls from './components/Controls.vue';
import MultiLink from './components/MultiLink.vue';
import ProvVis from './components/ProvVis.vue';

export default {
  name: 'App',

  components: {
    Controls,
    MultiLink,
    ProvVis,
  },

  setup() {
    const network = computed(() => store.getters.network);
    const selectedNodes = computed(() => store.getters.selectedNodes);
    const loadError = computed(() => store.getters.loadError);

    const multilinkContainer: Ref<Element | null> = ref(null);
    const multilinkContainerDimensions = computed(() => {
      if (multilinkContainer.value !== null) {
        return {
          width: multilinkContainer.value.clientWidth - 24,
          height: multilinkContainer.value.clientHeight - 24,
        };
      }
      return null;
    });

    const { workspace, graph, host } = getUrlVars();

    store.dispatch.fetchNetwork({
      workspaceName: workspace,
      networkName: graph,
      host,
    }).then(() => store.dispatch.createProvenance());

    // Provenance vis boolean
    const showProvenanceVis = computed(() => store.getters.showProvenanceVis);

    return {
      network,
      selectedNodes,
      loadError,
      multilinkContainer,
      multilinkContainerDimensions,
      showProvenanceVis,
    };
  },
};
</script>

<template>
  <v-app>
    <v-main>
      <controls />

      <multi-link
        v-if="network !== null && selectedNodes !== null"
      />

      <v-alert
        type="error"
        :value="loadError.message !== ''"
        prominent
      >
        <v-row align="center">
          <v-col class="grow">
            {{ loadError.message }}
          </v-col>
          <v-col class="shrink">
            <v-btn :href="loadError.href">
              {{ loadError.buttonText }}
            </v-btn>
          </v-col>
        </v-row>
      </v-alert>
    </v-main>

    <prov-vis v-if="showProvenanceVis" />
  </v-app>
</template>

<style>
html {
  scrollbar-width: none;
}

html::-webkit-scrollbar {
  display: none;
}

body {
  overflow: hidden;
}

#app {
  font-family: "Blinker", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow: none;
}

.v-btn__content {
  padding-bottom: 2px;
}
</style>
