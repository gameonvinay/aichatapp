export interface Skill {
  name?: string
  description?: string
}

export interface Task {
  id?: string
  description?: string
  title?: string
  completed?: boolean
  [key: string]: unknown
}

export interface Agent {
  id: string
  name?: string
  type?: string
  status?: string
  skills?: Skill[]
  tasks?: Task[]
  [key: string]: unknown
}
