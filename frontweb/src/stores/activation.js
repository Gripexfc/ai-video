import { defineStore } from 'pinia'
import { ref } from 'vue'
import { activationAPI } from '@/api/activation'

export const useActivationStore = defineStore('activation', () => {
  const isActivated = ref(false)
  const machineId = ref('')
  const checked = ref(false)

  async function checkStatus() {
    try {
      const res = await activationAPI.getStatus()
      isActivated.value = res.activated || false
      machineId.value = res.machine_id || ''
      if (!machineId.value) {
        try {
          const idRes = await activationAPI.getMachineId()
          machineId.value = idRes.machine_id || ''
        } catch (_) {}
      }
    } catch (_) {
      isActivated.value = false
    }
    checked.value = true
  }

  async function activate(code) {
    const res = await activationAPI.activate(code)
    isActivated.value = true
    return res
  }

  return { isActivated, machineId, checked, checkStatus, activate }
})
