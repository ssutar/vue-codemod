<template>
  <p>{{ greeting }} World!</p>
  <CC>sajdshjahj</CC>
  <FA>sdncjcdjs</FA>
</template>

<script>
import { defineComponent } from "vue";
import CC from "~/components/CC";

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
