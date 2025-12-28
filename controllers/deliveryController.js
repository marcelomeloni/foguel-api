import { supabase } from '../services/supabaseService.js';

// ============== UTILITÁRIOS DE FUSO HORÁRIO ==============

const getBrazilianDate = () => {
  const now = new Date();
  const options = { timeZone: 'America/Sao_Paulo' };
  return new Date(now.toLocaleString('en-US', options));
};

const getBrazilianDateString = () => {
  const brazilianDate = getBrazilianDate();
  const year = brazilianDate.getFullYear();
  const month = String(brazilianDate.getMonth() + 1).padStart(2, '0');
  const day = String(brazilianDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getBrazilianTimeString = () => {
  const brazilianDate = getBrazilianDate();
  const hours = String(brazilianDate.getHours()).padStart(2, '0');
  const minutes = String(brazilianDate.getMinutes()).padStart(2, '0');
  const seconds = String(brazilianDate.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

// ============== LISTAGEM DE ROTAS ==============

export const getTodayDeliveries = async (req, res) => {
  try {
    const { colaborador_id } = req.params;
    
    if (!colaborador_id) {
      return res.status(400).json({ error: 'ID do colaborador é obrigatório' });
    }

    const today = getBrazilianDateString();

    const { data: rotas, error } = await supabase
      .from('rotas')
      .select(`
        *,
        clientes!inner (
          nome,
          rua,
          numero,
          bairro,
          cidade,
          cep
        )
      `)
      .eq('colaborador_id', colaborador_id)
      .eq('data_entrega', today)
      .order('sequence', { ascending: true })
      .order('horario_previsto', { ascending: true });

    if (error) {
      console.error('Erro ao buscar rotas:', error);
      return res.status(400).json({ error: error.message });
    }

    const formattedRotas = (rotas || []).map(rota => {
      let status = rota.status;

      if (!status || status === 'pendente') {
          if (rota.entregue === true) {
              status = 'entregue';
          } else if (rota.entregue === false && rota.motivo_nao_entrega) {
              status = 'nao_entregue';
          } else if (rota.horario_real && !rota.entregue) {
              status = 'em_espera';
          } else {
              status = 'pendente';
          }
      }

      const horario_real = rota.horario_real; // Retorna timestamp ISO completo

      return {
        id: rota.id,
        cliente: rota.clientes?.nome || 'Cliente não encontrado',
        endereco: {
          rua: rota.clientes?.rua || '',
          numero: rota.clientes?.numero || '',
          bairro: rota.clientes?.bairro || '',
          cidade: rota.clientes?.cidade || '',
          cep: rota.clientes?.cep || '',
        },
        horario_previsto: rota.horario_previsto,
        status: status,
        entregue: rota.entregue,
        produtos: rota.produtos || [],
        observacoes: rota.observacoes,
        sequence: rota.sequence || 0,
        quem_recebeu: rota.quem_recebeu,
        motivo_nao_entrega: rota.motivo_nao_entrega,
        horario_real: horario_real,
        created_at: rota.created_at
      };
    });

    return res.json(formattedRotas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Obter detalhes de uma rota específica
export const getDeliveryDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: rota, error } = await supabase
      .from('rotas')
      .select(`
        *,
        clientes (*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar detalhes da rota:', error);
      return res.status(404).json({ error: 'Rota não encontrada' });
    }

    let status = rota.status || 'pendente';
    if (rota.entregue === true) {
      status = 'entregue';
    } else if (rota.entregue === false && rota.motivo_nao_entrega) {
      status = 'nao_entregue';
    } else if (rota.horario_real && !rota.entregue) {
      status = 'em_espera';
    }

    const enderecoCompleto = `${rota.clientes.rua}, ${rota.clientes.numero} - ${rota.clientes.bairro}, ${rota.clientes.cidade} - CEP ${rota.clientes.cep}`;

    const response = {
      id: rota.id,
      cliente: rota.clientes.nome,
      endereco: enderecoCompleto,
      endereco_detalhado: {
        rua: rota.clientes.rua,
        numero: rota.clientes.numero,
        bairro: rota.clientes.bairro,
        cidade: rota.clientes.cidade,
        cep: rota.clientes.cep
      },
      horario_previsto: rota.horario_previsto,
      status: status,
      entregue: rota.entregue,
      produtos: rota.produtos || [],
      observacoes: rota.observacoes,
      quem_recebeu: rota.quem_recebeu,
      motivo_nao_entrega: rota.motivo_nao_entrega,
      
      // CAMPOS PARA TIMER - Retorna timestamps ISO completos
      horario_real_timestamp: rota.horario_real, // Para cálculos no frontend
      horario_real_display: rota.horario_real, // Para exibição (o frontend formata)
      
      horario_chegada: rota.horario_chegada,
      horario_saida: rota.horario_saida,
      tempo_espera: rota.tempo_espera,
      tempo_total_espera: rota.tempo_total_espera,
      data_entrega: rota.data_entrega,
      created_at: rota.created_at,
      sequence: rota.sequence || 0
    };

    return res.json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ============== AÇÕES DE ENTREGA ==============

// ➤ Registrar chegada no local
export const registerArrival = async (req, res) => {
  try {
    const { id } = req.params;
    
    const now = new Date();
    const isoTimestamp = now.toISOString();

    const { data, error } = await supabase
      .from('rotas')
      .update({
        horario_real: isoTimestamp,
        horario_chegada: isoTimestamp,
        status: 'em_espera'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao registrar chegada:', error);
      return res.status(400).json({ error: error.message });
    }
    
    if (!data) return res.status(404).json({ error: 'Rota não encontrada' });

    return res.json({
      message: 'Chegada registrada com sucesso',
      horario_real_timestamp: isoTimestamp,
      rota: data
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Cancelar chegada
export const cancelArrival = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('rotas')
      .update({
        horario_real: null,
        horario_chegada: null,
        tempo_espera: null,
        tempo_total_espera: null,
        status: 'pendente'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao cancelar chegada:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({
      message: 'Chegada cancelada',
      rota: data
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Finalizar entrega com sucesso
export const finishDeliverySuccess = async (req, res) => {
  try {
    const { id } = req.params;
    const { quem_recebeu, observacoes, tempo_espera_segundos } = req.body;

    if (!quem_recebeu) {
      return res.status(400).json({ error: 'Nome de quem recebeu é obrigatório' });
    }

    const now = new Date();
    const isoTimestamp = now.toISOString();

    const updates = {
      entregue: true,
      quem_recebeu,
      observacoes: observacoes || null,
      horario_saida: isoTimestamp,
      tempo_total_espera: tempo_espera_segundos || 0,
      motivo_nao_entrega: null,
      status: 'entregue'
    };

    if (tempo_espera_segundos) {
      const horas = Math.floor(tempo_espera_segundos / 3600);
      const minutos = Math.floor((tempo_espera_segundos % 3600) / 60);
      const segundos = tempo_espera_segundos % 60;
      updates.tempo_espera = `${horas}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
    }

    const { data, error } = await supabase
      .from('rotas')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao finalizar entrega:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({
      message: 'Entrega finalizada com sucesso',
      horario_saida: isoTimestamp,
      rota: data
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Registrar entrega não realizada
export const finishDeliveryFailure = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo_nao_entrega, observacoes, tempo_espera_segundos } = req.body;

    if (!motivo_nao_entrega) {
      return res.status(400).json({ error: 'Motivo da não entrega é obrigatório' });
    }

    const now = new Date();
    const isoTimestamp = now.toISOString();

    const updates = {
      entregue: false,
      motivo_nao_entrega,
      observacoes: observacoes || null,
      horario_saida: isoTimestamp,
      tempo_total_espera: tempo_espera_segundos || 0,
      quem_recebeu: null,
      status: 'nao_entregue'
    };

    if (tempo_espera_segundos) {
      const horas = Math.floor(tempo_espera_segundos / 3600);
      const minutos = Math.floor((tempo_espera_segundos % 3600) / 60);
      const segundos = tempo_espera_segundos % 60;
      updates.tempo_espera = `${horas}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
    }

    const { data, error } = await supabase
      .from('rotas')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao registrar não entrega:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({
      message: 'Não entrega registrada',
      horario_saida: isoTimestamp,
      rota: data
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Atualizar tempo de espera em tempo real
export const updateWaitingTime = async (req, res) => {
  try {
    const { id } = req.params;
    const { tempo_espera_segundos } = req.body;

    if (tempo_espera_segundos === undefined) {
      return res.status(400).json({ error: 'Tempo de espera é obrigatório' });
    }

    const { data, error } = await supabase
      .from('rotas')
      .update({
        tempo_total_espera: tempo_espera_segundos
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar tempo de espera:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({
      message: 'Tempo de espera atualizado',
      tempo_total_espera: tempo_espera_segundos,
      rota: data
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Obter estatísticas do dia
export const getTodayStats = async (req, res) => {
  try {
    const { colaborador_id } = req.params;
    
    const today = getBrazilianDateString();

    const { data: rotas, error } = await supabase
      .from('rotas')
      .select('entregue, motivo_nao_entrega, tempo_total_espera, horario_real, created_at')
      .eq('colaborador_id', colaborador_id)
      .eq('data_entrega', today);

    if (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return res.status(400).json({ error: error.message });
    }

    const total = rotas.length;
    const entregues = rotas.filter(r => r.entregue === true).length;
    const naoEntregues = rotas.filter(r => r.entregue === false && r.motivo_nao_entrega).length;
    const emEspera = rotas.filter(r => r.horario_real && !r.entregue && !r.motivo_nao_entrega).length;
    const pendentes = rotas.filter(r => !r.horario_real && !r.entregue && !r.motivo_nao_entrega).length;
    
    const tempos = rotas
      .filter(r => r.tempo_total_espera)
      .map(r => r.tempo_total_espera);
    
    const tempoMedio = tempos.length > 0 
      ? tempos.reduce((a, b) => a + b, 0) / tempos.length 
      : 0;

    return res.json({
      total,
      entregues,
      nao_entregues: naoEntregues,
      em_espera: emEspera,
      pendentes,
      tempo_medio_espera_segundos: Math.round(tempoMedio),
      progresso: total > 0 ? ((entregues + naoEntregues) / total) * 100 : 0,
      data_brasilia: today
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Informações de fuso horário
export const getTimeInfo = async (req, res) => {
  try {
    const serverDate = new Date();
    const brazilianDate = getBrazilianDate();
    
    return res.json({
      servidor: {
        data_utc: serverDate.toISOString(),
        data_local: serverDate.toString(),
        fuso_horario: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      brasilia: {
        data_hora: brazilianDate.toString(),
        data: getBrazilianDateString(),
        hora: getBrazilianTimeString(),
        fuso_horario: 'America/Sao_Paulo (BRT/BRST)',
        iso_timestamp: brazilianDate.toISOString()
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};
