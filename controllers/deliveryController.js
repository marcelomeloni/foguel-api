import { supabase } from '../services/supabaseService.js';

// ============== LISTAGEM DE ROTAS ==============

// ➤ Listar rotas do dia atual para um colaborador específico
export const getTodayDeliveries = async (req, res) => {
  try {
    const { colaborador_id } = req.params;
    
    if (!colaborador_id) {
      return res.status(400).json({ error: 'ID do colaborador é obrigatório' });
    }

    // Obter data atual no formato YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

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

    // Formatar os dados para o frontend
  const formattedRotas = (rotas || []).map(rota => {
    
    // 1. Pega o status oficial do banco
    let status = rota.status;

    // 2. Só roda a lógica antiga SE o status vier vazio/nulo do banco
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
        horario_real: rota.horario_real
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

    // Calcular status visualmente
    let status = rota.status || 'pendente';
    if (rota.entregue === true) {
      status = 'entregue';
    } else if (rota.entregue === false && rota.motivo_nao_entrega) {
      status = 'nao_entregue';
    } else if (rota.horario_real && !rota.entregue) {
      status = 'em_espera';
    }

    // Formatar endereço completo
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
      horario_real: rota.horario_real,
      tempo_espera: rota.tempo_espera,
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
    
    // Obter horário atual
    const now = new Date();
    const horaAtual = now.toTimeString().split(' ')[0]; // Formato HH:MM:SS

    const { data, error } = await supabase
      .from('rotas')
      .update({
        horario_real: horaAtual,
        horario_chegada: horaAtual,
        status: 'em_espera' // <--- ATUALIZA STATUS NO BANCO
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
      horario_chegada: horaAtual,
      horario_real: horaAtual,
      rota: data
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Cancelar chegada (se clicou errado)
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
        status: 'pendente' // <--- REVERTE STATUS NO BANCO
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

    // Obter horário atual para saída
    const now = new Date();
    const horaSaida = now.toTimeString().split(' ')[0];

    const updates = {
      entregue: true,
      quem_recebeu,
      observacoes: observacoes || null,
      horario_saida: horaSaida,
      tempo_total_espera: tempo_espera_segundos || 0,
      motivo_nao_entrega: null,
      status: 'entregue' // <--- ATUALIZA STATUS NO BANCO
    };

    // Se forneceu tempo de espera em segundos, converte para intervalo PostgreSQL
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

    // Obter horário atual para saída
    const now = new Date();
    const horaSaida = now.toTimeString().split(' ')[0];

    const updates = {
      entregue: false,
      motivo_nao_entrega,
      observacoes: observacoes || null,
      horario_saida: horaSaida,
      tempo_total_espera: tempo_espera_segundos || 0,
      quem_recebeu: null,
      status: 'nao_entregue' // <--- ATUALIZA STATUS NO BANCO
    };

    // Se forneceu tempo de espera em segundos
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
    
    const today = new Date().toISOString().split('T')[0];

    const { data: rotas, error } = await supabase
      .from('rotas')
      .select('entregue, motivo_nao_entrega, tempo_total_espera, horario_real')
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
    
    // Calcular tempo médio de espera
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
      progresso: total > 0 ? ((entregues + naoEntregues) / total) * 100 : 0
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};