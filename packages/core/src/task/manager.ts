import type { Task } from "./types.js"

type Listener = () => void

class TaskManagerImpl {
  private tasks = new Map<string, Task>()
  private listeners = new Set<Listener>()

  public onUpdate(cb: Listener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private emit() {
    this.listeners.forEach((cb) => cb())
  }

  public getTasks(): Task[] {
    return Array.from(this.tasks.values())
  }

  public getTask(id: string): Task | undefined {
    return this.tasks.get(id)
  }

  /**
   * Kahn Algoritması ile Deadlock (Döngüsel Bağımlılık) Kontrolü
   */
  private hasCycle(tasksToCheck: Task[]): boolean {
    const adj = new Map<string, string[]>()
    const inDegree = new Map<string, number>()

    for (const t of tasksToCheck) {
      adj.set(t.id, [])
      inDegree.set(t.id, 0)
    }

    for (const t of tasksToCheck) {
      for (const blockerId of t.blockedBy) {
        if (!adj.has(blockerId)) continue // Eğer blocker listede yoksa yoksay (veya hata verilebilir)
        adj.get(blockerId)!.push(t.id)
        inDegree.set(t.id, inDegree.get(t.id)! + 1)
      }
    }

    const q: string[] = []
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) q.push(id)
    }

    let visited = 0
    while (q.length > 0) {
      const curr = q.shift()!
      visited++
      for (const neighbor of adj.get(curr)!) {
        const newDeg = inDegree.get(neighbor)! - 1
        inDegree.set(neighbor, newDeg)
        if (newDeg === 0) q.push(neighbor)
      }
    }

    return visited !== tasksToCheck.length
  }

  /**
   * Yeni bir görev oluşturur. Deadlock yaratıyorsa hata fırlatır.
   */
  public createTask(id: string, subject: string, blockedBy: string[] = []): Task {
    if (this.tasks.has(id)) throw new Error(`Task ID ${id} already exists.`)

    const newTask: Task = {
      id,
      subject,
      status: "pending",
      blockedBy,
      context: ""
    }

    // Geçici bir kopya üzerinde cycle kontrolü yap
    const tempTasks = [...this.getTasks(), newTask]
    if (this.hasCycle(tempTasks)) {
      throw new Error(`Circular dependency detected! Adding task ${id} blocked by [${blockedBy.join(", ")}] creates a deadlock.`)
    }

    this.tasks.set(id, newTask)
    this.emit()
    return newTask
  }

  /**
   * Görevi günceller ve bağımlılıkları kontrol eder.
   */
  public updateTask(id: string, updates: Partial<Task>): Task {
    const task = this.tasks.get(id)
    if (!task) throw new Error(`Task ${id} not found.`)

    if (updates.blockedBy) {
      const tempTask = { ...task, blockedBy: updates.blockedBy }
      const tempTasks = this.getTasks().map(t => t.id === id ? tempTask : t)
      if (this.hasCycle(tempTasks)) {
         throw new Error(`Circular dependency detected! Updating task ${id} blocked by [${updates.blockedBy.join(", ")}] creates a deadlock.`)
      }
    }

    if (updates.status === "in_progress" && task.status !== "in_progress") {
      task.startedAt = Date.now()
    }

    Object.assign(task, updates)
    this.emit()
    return task
  }

  /**
   * Görevi bitirir ve ona bağlı olan görevlere (dependent tasks) sonucu iletir (Context Passing)
   */
  public completeTask(id: string, result: string) {
    const task = this.tasks.get(id)
    if (!task) throw new Error(`Task ${id} not found.`)

    task.status = "done"
    task.result = result
    
    // Bu görevi bekleyen (blockedBy'sında bu id olan) görevleri bul
    for (const t of this.getTasks()) {
      if (t.blockedBy.includes(id)) {
        // Context Passing: Başarılı olan veriyi beklemedeki görevin bağlamına enjekte et
        t.context = t.context 
          ? `${t.context}\n[Context from ${id}]: ${result}`
          : `[Context from ${id}]: ${result}`
          
        // Blocker listesinden çıkar (artık beklemese de olur)
        t.blockedBy = t.blockedBy.filter(b => b !== id)
      }
    }

    this.emit()
  }

  public failTask(id: string, error: string) {
    const task = this.tasks.get(id)
    if (!task) throw new Error(`Task ${id} not found.`)

    task.status = "error"
    task.error = error
    this.emit()
  }
}

export const taskManager = new TaskManagerImpl()
