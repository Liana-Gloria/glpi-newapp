import api from './client'

export async function fetchTickets() {
  const { data } = await api.get('/tickets')
  return data
}

export async function fetchTicket(id) {
  const { data } = await api.get(`/tickets/${id}`)
  return data
}

export async function createTicket({ title, description, priority, item_ids }) {
  const { data } = await api.post('/tickets', { title, description, priority, item_ids })
  return data
}

export async function updateTicketStatus(id, status, resolution, cout) {
  const payload = { status }
  if (resolution !== undefined) payload.resolution = resolution
  if (cout !== undefined) payload.cout = cout
  const { data } = await api.patch(`/tickets/${id}/status`, payload)
  return data
}

export async function fetchCoutsParItem() {
  const { data } = await api.get('/tickets/couts-par-item')
  return data
}
