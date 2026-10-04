declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string | null
    image: string | null
    ownChannel?: {
      id: string
      title: string
      handle: string | null
      thumbnail: string
    } | null
  }
}

export {}
