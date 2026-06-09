import api from './client'

export async function fetchTickets() {
  const { data } = await api.get('/tickets')
  return data
}

export async function fetchTicket(id) {
  const { data } = await api.get(`/tickets/${id}`)
  return data
}

export async function createTicket({ title, description, item_ids }) {
  const { data } = await api.post('/tickets', { title, description, item_ids })
  return data
}

export async function updateTicketStatus(id, status) {
  const { data } = await api.patch(`/tickets/${id}/status`, { status })
  return data
}
