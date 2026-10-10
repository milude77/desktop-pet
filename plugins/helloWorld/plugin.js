export default {
  id: "hello-world",

  async onLoad(context) {
    context.bubble.show("Hello World!")
  },
}