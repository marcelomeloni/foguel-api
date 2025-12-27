import { supabase } from '../services/supabaseService.js';

// Função auxiliar para calcular "Há x tempo"
const getTimeAgo = (dateString) => {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMins / 60);

  if (diffMins < 1) return 'Agora mesmo';
  if (diffMins < 60) return `${diffMins} min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  return past.toLocaleDateString('pt-BR');
};

export const getRecentActivity = async (req, res) => {
  try {
    // 1. Buscar as últimas 20 atividades
    const { data: activities, error } = await supabase
      .from('activities') // Certifique-se que sua tabela chama 'activities'
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    // 2. Extrair IDs únicos para buscar Nomes (Colaboradores e Clientes)
    // Isso evita mostrar UUIDs no front e evita N+1 queries
    const colabIds = new Set();
    const clienteIds = new Set();

    activities.forEach(item => {
      const data = item.new_data || item.old_data;
      if (data?.colaborador_id) colabIds.add(data.colaborador_id);
      if (data?.cliente_id) clienteIds.add(data.cliente_id);
    });

    // 3. Buscar nomes no banco
    const { data: colaboradores } = await supabase
      .from('colaboradores')
      .select('id, nome')
      .in('id', [...colabIds]);

    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, nome')
      .in('id', [...clienteIds]);

    // Criar mapas para acesso rápido: { 'uuid': 'Nome' }
    const colabMap = (colaboradores || []).reduce((acc, c) => ({ ...acc, [c.id]: c.nome }), {});
    const clienteMap = (clientes || []).reduce((acc, c) => ({ ...acc, [c.id]: c.nome }), {});

    // 4. Traduzir as atividades em "Histórias"
    const formattedActivities = activities.map(act => {
      const nova = act.new_data || {};
      const antiga = act.old_data || {};
      
      let text = 'Atualização no sistema';
      let type = 'info'; // 'info', 'success', 'warning'

      const nomeColaborador = colabMap[nova.colaborador_id || antiga.colaborador_id] || 'Colaborador';
      const nomeCliente = clienteMap[nova.cliente_id || antiga.cliente_id] || 'Cliente';

      // --- LÓGICA DE TRADUÇÃO ---

      if (act.table_name === 'rotas') {
        if (act.action === 'INSERT') {
           text = `Nova rota criada para ${nomeCliente}`;
           type = 'info';
        } 
        else if (act.action === 'UPDATE') {
          // Caso: Chegou no local
          if (!antiga.horario_chegada && nova.horario_chegada) {
            text = `${nomeColaborador} chegou no local de entrega`;
            type = 'info';
          }
          // Caso: Entrega realizada com sucesso
          else if (!antiga.entregue && nova.entregue === true) {
            text = `${nomeColaborador} finalizou a entrega para ${nomeCliente}`;
            type = 'success';
          }
          // Caso: Não conseguiu entregar
          else if (nova.status === 'nao_entregue' && antiga.status !== 'nao_entregue') {
            const motivo = nova.motivo_nao_entrega || 'Motivo não informado';
            text = `${nomeColaborador} não entregou. Motivo: ${motivo}`;
            type = 'warning';
          }
          // Caso: Começou a rota (saiu do status pendente)
          else if (antiga.status === 'pendente' && nova.status === 'em_rota') {
             text = `${nomeColaborador} iniciou o trajeto`;
             type = 'info';
          }
          // Caso genérico de status
          else if (antiga.status !== nova.status) {
             text = `Status da rota alterado para: ${nova.status.replace('_', ' ')}`;
          }
        }
      } 
      
      else if (act.table_name === 'produtos') {
        if (act.action === 'INSERT') {
          text = `Novo produto criado: ${nova.nome}`;
          type = 'info';
        } else if (act.action === 'UPDATE') {
          text = `Produto "${nova.nome}" foi atualizado`;
        }
      }

      else if (act.table_name === 'colaboradores') {
        if (act.action === 'INSERT') text = `Novo colaborador cadastrado: ${nova.nome}`;
      }

      return {
        id: act.idx || act.record_id, // Usando idx se disponível ou uuid
        type,
        text,
        time: getTimeAgo(act.changed_at)
      };
    });

    return res.status(200).json(formattedActivities);

  } catch (error) {
    console.error('Erro ao buscar atividades:', error);
    return res.status(500).json({ error: 'Erro ao processar atividades' });
  }

};

export const getDashboardStats = async (req, res) => {
  try {
    // Pegar a data de hoje no formato YYYY-MM-DD
    // Nota: Em produção, verifique se o fuso horário do servidor bate com o do Brasil
    const today = new Date().toISOString().split('T')[0]; 

    // Buscar todas as rotas de hoje
    const { data: rotas, error } = await supabase
      .from('rotas')
      .select('status, entregue') // Trazemos apenas o necessário para contar
      .eq('data_entrega', today);

    if (error) throw error;

    // Calcular estatísticas
    const stats = {
      totalEntregas: rotas.length,
      concluidas: 0,
      pendentes: 0,
      ocorrencias: 0
    };

    rotas.forEach(rota => {
      if (rota.status === 'entregue') {
        stats.concluidas++;
      } else if (rota.status === 'nao_entregue') {
        stats.ocorrencias++;
      } else {
        // Consideramos 'pendente', 'em_rota', 'em_espera' como pendentes
        stats.pendentes++;
      }
    });

    return res.status(200).json(stats);

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return res.status(500).json({ error: 'Erro ao calcular estatísticas' });
  }
};
