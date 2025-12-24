"""
Node Registry - Central registry for all node types.

Nodes register themselves using the @node_registry.register decorator.
The executor uses this registry to instantiate nodes by type.
"""

from typing import Type, TypeVar

from nodes.base import BaseNode

T = TypeVar("T", bound=BaseNode)


class NodeRegistry:
    """
    Registry for node types.

    Provides a central place to register and lookup node classes by type.
    Uses the decorator pattern for easy registration.

    Example:
        @node_registry.register
        class MyNode(BaseNode):
            node_type = "my_node"
    """

    def __init__(self):
        self._nodes: dict[str, Type[BaseNode]] = {}

    def register(self, node_class: Type[T]) -> Type[T]:
        """
        Register a node class.

        Can be used as a decorator:
            @registry.register
            class MyNode(BaseNode):
                node_type = "my_node"

        Args:
            node_class: Node class to register

        Returns:
            The same class (for decorator chaining)

        Raises:
            ValueError: If node_type is not defined
        """
        node_type = getattr(node_class, "node_type", None)
        if not node_type or node_type == "base":
            raise ValueError(
                f"Node class {node_class.__name__} must define a unique 'node_type'"
            )

        self._nodes[node_type] = node_class
        return node_class

    def get(self, node_type: str) -> Type[BaseNode]:
        """
        Get a node class by type.

        Args:
            node_type: The node type string

        Returns:
            The registered node class

        Raises:
            KeyError: If node type is not registered
        """
        if node_type not in self._nodes:
            raise KeyError(f"Unknown node type: {node_type}")
        return self._nodes[node_type]

    def list_types(self) -> list[str]:
        """List all registered node types."""
        return list(self._nodes.keys())


# Global registry instance
node_registry = NodeRegistry()
