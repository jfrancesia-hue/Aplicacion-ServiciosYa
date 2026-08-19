import type React from 'react';
import { TouchableOpacity, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';

type SocialButtonProps = {
    onPress: () => void;
    icon: React.ReactNode;
    text: string;
    backgroundColor?: string;
    textColor?: string;
    style?: ViewStyle;
    textStyle?: TextStyle;
};

export default function SocialButton({
    onPress,
    icon,
    text,
    backgroundColor = '#4c81e4',
    textColor = '#fff',
    style,
    textStyle,
}: SocialButtonProps) {
    return (
        <TouchableOpacity
            style={[
                styles.button,
                { backgroundColor },
                style,
            ]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {icon}
            <Text style={[styles.text, { color: textColor }, textStyle]}>
                {text}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        paddingVertical: 10,
        borderRadius: 30,
        alignItems: 'center',
        width: '100%',
        elevation: 5,
        flexDirection: 'row',
        justifyContent: 'center',
        height: 48,
    },
    text: {
        fontWeight: '700',
        fontSize: 16,
        marginLeft: 10,
    },
});