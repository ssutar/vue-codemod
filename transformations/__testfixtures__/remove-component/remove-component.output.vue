<template>
  <p>{{ greeting }} World!</p>
<FA>djskkjds</FA>
<CC>wjdjl</CC>
</template>

<script>
import { defineComponent } from "vue";
import CC from "~/components/CC";

import FA from "~/components/FA";

export default defineComponent({
  data() {
    return {
      greeting: "Hello"
    };
  }
});
</script>

<style scoped>
p {
  font-size: 2em;
  text-align: center;
}
</style>

