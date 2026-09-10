import React, { useState, useRef, useEffect, cache } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native'; 
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import BotonVolver from '../components/BotonVolver';
import { getUserID } from '../store/authStore';

export default function Chat() {
  const navigation = useNavigation();
  const chatChannelRef = useRef(null);
  const mensajeChannelRef = useRef(null);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // Función para cargar los chats iniciales
  const obtenerChatsInicial = async (userId) => {
    setLoading(true);

    const { data: chatsData, error } = await supabase
      .from('chats')
      .select(`
        id,
        participant_a,
        participant_b,
        updated_at,
        mensajes (
          id,
          leido,
          remitente_id,
          contenido,
          created_at
        )
      `)
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (error || !chatsData) {
      console.error('Error al cargar chats:', error?.message);
      setLoading(false);
      return;
    }

    const chatsFormateados = await Promise.all(
      chatsData.map(async (chat) => {
        const otroUsuarioId = chat.participant_a === userId ? chat.participant_b : chat.participant_a;

        const mensajesOrdenados = [...(chat.mensajes ?? [])].sort((a, b) => {
          const ta = new Date(a.created_at ?? '').getTime();
          const tb = new Date(b.created_at ?? '').getTime();
          return ta - tb;
        });

        const mensajesNoLeidos = mensajesOrdenados.filter(
          msg => !msg.leido && msg.remitente_id !== userId
        ).length;

        const ultimoMensaje = mensajesOrdenados?.[mensajesOrdenados.length - 1]?.contenido || 'Entra para comenzar a chatear';

        const { data: usuario } = await supabase
          .from('user_public_profiles')
          .select('nombre, foto_perfil')
          .eq('id', otroUsuarioId)
          .single();

        return {
          id: chat.id,
          nombre: usuario?.nombre || 'Desconocido',
          avatar: usuario?.foto_perfil || 'https://picsum.photos/id/9/200/300',
          mensaje: ultimoMensaje,
          servicioId: null,
          servicio: null,
          noLeidos: mensajesNoLeidos,
          usuario_1: chat.participant_a,
          usuario_2: chat.participant_b,
        };
      })
    );

    setChats(chatsFormateados);
    setLoading(false);
  };

  const eliminarChat = async (item) => {
    if (!userId) return;
    try {
      // Schema nuevo: hard-delete del chat (FK ON DELETE CASCADE limpia mensajes).
      await supabase
        .from('chats')
        .delete()
        .eq('id', item.id);
    } catch (error) {
      console.log(error);
    }
    obtenerChatsInicial(userId);
  };

  useEffect(() => {
    let isMounted = true;

    const setupRealtime = async () => {
      const userId = getUserID();

      await obtenerChatsInicial(userId);

      // Limpiar canales previos
      if (chatChannelRef.current) supabase.removeChannel(chatChannelRef.current);
      if (mensajeChannelRef.current) supabase.removeChannel(mensajeChannelRef.current);

      // CANAL CHATS: detectar chats nuevos o cambios
      const channelChats = supabase
        .channel('realtime-chats')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chats' },
          async (payload) => {
            if (isMounted) {
              const chat = payload.new;
              if (!chat) return;
              if (chat.participant_a !== userId && chat.participant_b !== userId) return;

              if (payload.eventType === 'INSERT') {
                // Traer datos del usuario
                const otroUsuarioId = chat.participant_a === userId ? chat.participant_b : chat.participant_a;
                const { data: usuario } = await supabase
                  .from('user_public_profiles')
                  .select('nombre, foto_perfil')
                  .eq('id', otroUsuarioId)
                  .single();

                // Luego actualizar estado de manera síncrona
                setChats(prevChats => [
                  {
                    id: chat.id,
                    nombre: usuario?.nombre || 'Desconocido',
                    avatar: usuario?.foto_perfil,
                    mensaje: 'Entra para comenzar a chatear',
                    servicioId: null,
                    servicio: null,
                    noLeidos: 0,
                    usuario_1: chat.participant_a,
                    usuario_2: chat.participant_b,
                  },
                  ...(prevChats || []), // prevChats podría ser undefined al inicio
                ]);
              }
            }
          }
        )
        .subscribe();

      chatChannelRef.current = channelChats;

      // CANAL MENSAJES: detectar mensajes nuevos en chats existentes
      const channelMensajes = supabase
        .channel('realtime-mensajes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'mensajes' },
          async (payload) => {
            if (isMounted) { 
              const msg = payload.new;
              if (!msg) return; 

              // Filtrar rápido: si el usuario no está involucrado, ignorar
              //if (msg.remitente_id === userId || msg.receptor_id === userId) { 
                  const { data: mensajesNoLeidosData, error: errorMensajes } = await supabase
                    .from('mensajes')
                    .select('id')
                    .eq('chat_id', msg.chat_id)
                    .eq('leido', false)
                    .neq('remitente_id', userId);

                  const cantidadNoLeidos = errorMensajes ? 0 : mensajesNoLeidosData.length;

                  setChats(prevChats => prevChats.map(chat => {
                    if (chat.id === msg.chat_id) {
                      return {
                        ...chat,
                        mensaje: msg.contenido,
                        noLeidos: cantidadNoLeidos,
                      };
                    }
                    return chat;
                  }));
              //}
            }
          }
        )
        .subscribe();

      mensajeChannelRef.current = channelMensajes;
    };

    setupRealtime();

    return () => {
      isMounted = false;
      if (chatChannelRef.current) supabase.removeChannel(chatChannelRef.current);
      if (mensajeChannelRef.current) supabase.removeChannel(mensajeChannelRef.current);
    };
  }, []);

  const renderItem = ({ item }) => {
    
    const handleEliminar = () => {
      Alert.alert(
        "Eliminar chat",
        "¿Seguro que deseas eliminar este chat? No podrás ver los mensajes antiguos.",
        [
          { text: "Cancelar", style: "cancel" },
          { 
            text: "Eliminar", 
            style: "destructive",
            onPress: () => eliminarChat(item) 
          }
        ]
      );
    };

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigation.navigate('ChatIndividual', {
          chatId: item.id,
          nombre: item.nombre,
          servicio: item.servicio,
          usuarioId1: item.usuario_1,
          usuarioId2: item.usuario_2,
          servicioId: item.servicioId,
        })}
        onLongPress={handleEliminar}
      >
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <View style={styles.textos}>
          <Text style={styles.nombre}>{item.nombre}</Text>
          <Text style={styles.mensaje} numberOfLines={1}>{item.mensaje}</Text>
        </View>
        <View style={{ position: 'relative' }}>
          <Ionicons name="chevron-forward" size={22} color="#30D5C8" style={styles.chevronIcon} />
          {item.noLeidos > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.noLeidos}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>📨 Tus chats</Text>
      <BotonVolver />
      {loading ? (
        <ActivityIndicator size="large" color="#FF7E5F" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1,
     backgroundColor: '#E8FAF7',
     paddingTop: 46,
     paddingHorizontal: 12 
  },
  titulo: { fontSize: 32,
     fontWeight: '800',
     color: '#202B3A',
     marginBottom: 20,
     paddingTop: 30,
     textAlign: 'center',
     letterSpacing: 1,
     textShadowColor: '#b6e1ea88',
     textShadowOffset: { width: 0, height: 2 },
     textShadowRadius: 6 
  },
  chatItem: { 
     flexDirection: 'row',
     alignItems: 'center',
     backgroundColor: '#fff',
     borderRadius: 24,
     marginBottom: 18,
     padding: 14,
     shadowColor: '#1FCFC020',
     shadowOffset: { width: 0, height: 6 },
     shadowOpacity: 0.10,
     shadowRadius: 16,
     elevation: 2 
  },
  avatar: { 
     width: 46,
     height: 46,
     borderRadius: 23,
     marginRight: 10,
     borderWidth: 2,
     borderColor: '#069eb3',
     backgroundColor: '#F3FFFE' 
  },
  textos: { 
    flex: 1 
  },
  nombre: {
    fontSize: 17,
    fontWeight: '700',
    color: '#202B3A',
    marginBottom: 1 
  },
  mensaje: { 
    fontSize: 14, 
    color: '#6A6A6A', 
    marginTop: 2 
  },
  chevronIcon: { 
    marginLeft: 10, 
    color: '#FFA13C' 
  },
  badge: { 
    position: 'absolute',
    top: 2,
    right: 25,
    backgroundColor: '#FF5A5F',
    color:"#fff",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center' 
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
