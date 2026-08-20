import { ref } from 'vue'

const scroller = ref<HTMLElement | null>(null)

export function useScroller() {
  function setScroller(el: HTMLElement | null) {
    scroller.value = el
  }
  return {
    scroller,
    setScroller,
  }
}
